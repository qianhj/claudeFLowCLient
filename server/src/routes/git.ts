import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { normalizePath } from "../utils/pathUtils.js";

const router: ExpressRouter = Router();

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  relativeDate: string;
}

interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

// ── Resolve git executable ──
function findGit(): string {
  const probe = spawnSync("git", ["--version"], { encoding: "utf-8", stdio: "pipe" });
  if (probe.status === 0) return "git";

  const candidates = [
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
    "D:\\softwore\\Git\\cmd\\git.exe",
    "D:\\software\\Git\\cmd\\git.exe",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Programs", "Git", "cmd", "git.exe")
      : "",
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, "Git", "cmd", "git.exe")
      : "",
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "git";
}

const GIT_EXE = findGit();

// Use spawnSync (not execSync) to avoid Windows cmd.exe shell interpretation of % and |
function runGit(cwd: string, args: string[]): string {
  const result = spawnSync(GIT_EXE, args, {
    cwd,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Git command failed").trim());
  }
  return (result.stdout || "").trim();
}

function isGitRepo(cwd: string): { result: boolean; reason?: string } {
  if (!fs.existsSync(cwd)) {
    return { result: false, reason: `路径不存在: ${cwd}` };
  }
  const r = spawnSync(GIT_EXE, ["rev-parse", "--git-dir"], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });
  if (r.status === 0) return { result: true };
  const msg = (r.stderr || "").trim();
  return {
    result: false,
    reason:
      msg.includes("not a git") || msg.includes("fatal")
        ? "不是 Git 仓库"
        : `Git 命令失败: ${msg || "未知"} (可执行文件: ${GIT_EXE})`,
  };
}

// GET /api/git/status
router.get("/status", async (req, res) => {
  const projectPath = normalizePath(req.query.path as string);
  if (!projectPath) return res.status(400).json({ error: "Project path required" });

  const { result, reason } = isGitRepo(projectPath);
  if (!result) {
    return res.json({
      isRepo: false,
      reason,
      checkedPath: projectPath,
      branch: null,
      ahead: 0,
      behind: 0,
      modified: [],
      staged: [],
      untracked: [],
      conflicted: [],
      isClean: true,
    });
  }

  try {
    let branch: string;
    try {
      branch = runGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    } catch {
      branch = "HEAD";
    }

    let ahead = 0;
    let behind = 0;
    try {
      const upstream = runGit(projectPath, ["rev-parse", "--abbrev-ref", "@{upstream}"]);
      if (upstream && !upstream.includes(" ")) {
        const count = runGit(projectPath, [
          "rev-list", "--left-right", "--count", `${upstream}...HEAD`,
        ]);
        const [b, a] = count.split("\t").map((n) => parseInt(n) || 0);
        behind = b;
        ahead = a;
      }
    } catch {
      // No upstream
    }

    const statusOutput = runGit(projectPath, ["status", "--porcelain=v1", "-u"]);
    const lines = statusOutput ? statusOutput.split("\n") : [];

    const modified: string[] = [];
    const staged: string[] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];

    for (const line of lines) {
      if (!line) continue;
      const x = line[0];
      const y = line[1];
      const file = line.slice(3);
      if (x === "?" && y === "?") {
        untracked.push(file);
      } else if (x === "U" || y === "U" || (x === "D" && y === "D") || (x === "A" && y === "A")) {
        conflicted.push(file);
      } else if (x !== " " && x !== "?") {
        staged.push(file);
      } else if (y !== " ") {
        modified.push(file);
      }
    }

    const isClean =
      modified.length === 0 && staged.length === 0 &&
      untracked.length === 0 && conflicted.length === 0;

    res.json({ isRepo: true, branch, ahead, behind, modified, staged, untracked, conflicted, isClean });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get git status" });
  }
});

// GET /api/git/log
router.get("/log", async (req, res) => {
  const projectPath = normalizePath(req.query.path as string);
  const limit = parseInt(req.query.limit as string) || 50;
  if (!projectPath) return res.status(400).json({ error: "Project path required" });

  const { result } = isGitRepo(projectPath);
  if (!result) return res.json({ commits: [], isRepo: false });

  try {
    // Use separate --format flag to avoid shell interpretation of format string
    const output = runGit(projectPath, [
      "log",
      "--format=%H\x1f%h\x1f%s\x1f%an\x1f%ai\x1f%ar",
      "-n",
      limit.toString(),
    ]);

    const commits: GitCommit[] = output
      ? output.split("\n").filter(Boolean).map((line) => {
          const [hash, shortHash, message, author, date, relativeDate] = line.split("\x1f");
          return { hash, shortHash, message, author, date, relativeDate };
        })
      : [];

    res.json({ commits, isRepo: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get git log" });
  }
});

// GET /api/git/branches
router.get("/branches", async (req, res) => {
  const projectPath = normalizePath(req.query.path as string);
  if (!projectPath) return res.status(400).json({ error: "Project path required" });

  const { result } = isGitRepo(projectPath);
  if (!result) return res.json({ branches: [], current: null, isRepo: false });

  try {
    const output = runGit(projectPath, ["branch", "-a", "--format=%(refname:short)|%(HEAD)"]);
    const current = runGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]);

    const branches: GitBranch[] = output
      ? output
          .split("\n")
          .filter((b) => b && !b.includes("HEAD detached"))
          .map((b) => {
            const [name, head] = b.split("|");
            const isCurrent = head?.trim() === "*" || name.trim() === current;
            const isRemote = name.startsWith("remotes/");
            return {
              name: isRemote ? name.replace("remotes/", "") : name,
              isCurrent,
              isRemote,
            };
          })
          .filter((b, i, arr) => arr.findIndex((x) => x.name === b.name) === i)
      : [];

    res.json({ branches, current, isRepo: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get branches" });
  }
});

// POST /api/git/commit
router.post("/commit", async (req, res) => {
  const { path: projectPath, message } = req.body;
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath || !message) return res.status(400).json({ error: "Project path and message required" });

  const { result, reason } = isGitRepo(normalizedPath);
  if (!result) return res.status(400).json({ error: reason || "Not a git repository" });

  try {
    runGit(normalizedPath, ["commit", "-m", message]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to commit" });
  }
});

// POST /api/git/add
router.post("/add", async (req, res) => {
  const { path: projectPath, files } = req.body;
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath || !files || !Array.isArray(files))
    return res.status(400).json({ error: "Project path and files array required" });

  const { result, reason } = isGitRepo(normalizedPath);
  if (!result) return res.status(400).json({ error: reason || "Not a git repository" });

  try {
    for (const file of files) runGit(normalizedPath, ["add", file]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to stage files" });
  }
});

// POST /api/git/unstage
router.post("/unstage", async (req, res) => {
  const { path: projectPath, files } = req.body;
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath || !files || !Array.isArray(files))
    return res.status(400).json({ error: "Project path and files array required" });

  const { result, reason } = isGitRepo(normalizedPath);
  if (!result) return res.status(400).json({ error: reason || "Not a git repository" });

  try {
    for (const file of files) runGit(normalizedPath, ["reset", "HEAD", file]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to unstage files" });
  }
});

// POST /api/git/checkout
router.post("/checkout", async (req, res) => {
  const { path: projectPath, branch, create } = req.body;
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath || !branch) return res.status(400).json({ error: "Project path and branch required" });

  const { result, reason } = isGitRepo(normalizedPath);
  if (!result) return res.status(400).json({ error: reason || "Not a git repository" });

  try {
    if (create) runGit(normalizedPath, ["checkout", "-b", branch]);
    else runGit(normalizedPath, ["checkout", branch]);
    res.json({ success: true, branch });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to checkout branch" });
  }
});

// POST /api/git/discard
router.post("/discard", async (req, res) => {
  const { path: projectPath, files } = req.body;
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath || !files || !Array.isArray(files))
    return res.status(400).json({ error: "Project path and files array required" });

  const { result, reason } = isGitRepo(normalizedPath);
  if (!result) return res.status(400).json({ error: reason || "Not a git repository" });

  try {
    for (const file of files) runGit(normalizedPath, ["checkout", "--", file]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to discard changes" });
  }
});

// POST /api/git/init
router.post("/init", async (req, res) => {
  const { path: projectPath } = req.body;
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath) return res.status(400).json({ error: "Project path required" });

  try {
    runGit(normalizedPath, ["init"]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to init repository" });
  }
});

// GET /api/git/diff
router.get("/diff", async (req, res) => {
  const projectPath = normalizePath(req.query.path as string);
  const file = req.query.file as string;
  const staged = req.query.staged === "true";
  if (!projectPath) return res.status(400).json({ error: "Project path required" });

  const { result, reason } = isGitRepo(projectPath);
  if (!result) return res.status(400).json({ error: reason || "Not a git repository" });

  try {
    const args = staged ? ["diff", "--cached"] : ["diff"];
    if (file) args.push(file);
    const diff = runGit(projectPath, args);
    res.json({ diff });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get diff" });
  }
});

export default router;
