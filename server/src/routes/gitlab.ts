import { Router } from "express";
import { ConfigService } from "../services/configService.js";

const router = Router();
const configService = new ConfigService();

async function glFetch(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitLab API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

async function getGLConfig() {
  const config = await configService.getConfig();
  const url = ((config.gitlabUrl as string) || "https://gitlab.com").replace(/\/$/, "");
  const token = (config.gitlabToken as string) || "";
  // Debug: log token presence (without exposing full token)
  console.log("[GitLab Config] URL:", url, "Token present:", !!token, "Token length:", token.length);
  return { url, token };
}

// GET /api/gitlab/config
router.get("/config", async (_req, res) => {
  const { url, token } = await getGLConfig();
  res.json({ configured: !!token, url });
});

// PUT /api/gitlab/config
router.put("/config", async (req, res) => {
  try {
    const { url, token } = req.body;
    await configService.updateConfig({
      gitlabUrl: url || "https://gitlab.com",
      gitlabToken: token || "",
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/profile
router.get("/profile", async (_req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const data = await glFetch(`${url}/api/v4/user`, token);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/groups
router.get("/groups", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const search = req.query.search ? `&search=${encodeURIComponent(req.query.search as string)}` : "";
    const data = await glFetch(
      `${url}/api/v4/groups?min_access_level=10&per_page=100&order_by=name&sort=asc${search}`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects
router.get("/projects", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const { search, group_id, page = "1" } = req.query;
    let endpoint: string;
    if (group_id) {
      endpoint = `${url}/api/v4/groups/${group_id}/projects?per_page=50&page=${page}&order_by=last_activity_at`;
    } else {
      endpoint = `${url}/api/v4/projects?membership=true&per_page=50&page=${page}&order_by=last_activity_at`;
    }
    if (search) endpoint += `&search=${encodeURIComponent(search as string)}`;
    const data = await glFetch(endpoint, token);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects/:id/tree
router.get("/projects/:id/tree", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const { path = "", ref = "HEAD" } = req.query;
    const data = await glFetch(
      `${url}/api/v4/projects/${encodeURIComponent(req.params.id)}/repository/tree?path=${encodeURIComponent(path as string)}&ref=${encodeURIComponent(ref as string)}&per_page=100`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects/:id/files?filepath=...&ref=...
router.get("/projects/:id/files", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const { filepath, ref = "HEAD" } = req.query;
    if (!filepath) return res.status(400).json({ error: "filepath required" });
    const data = await glFetch(
      `${url}/api/v4/projects/${encodeURIComponent(req.params.id)}/repository/files/${encodeURIComponent(filepath as string)}?ref=${encodeURIComponent(ref as string)}`,
      token
    ) as { content?: string; encoding?: string };
    // Decode base64 content
    if (data.content && data.encoding === "base64") {
      (data as Record<string, unknown>).decodedContent = Buffer.from(data.content, "base64").toString("utf-8");
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects/:id/branches
router.get("/projects/:id/branches", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const data = await glFetch(
      `${url}/api/v4/projects/${encodeURIComponent(req.params.id)}/repository/branches?per_page=100`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects/:id/commits
router.get("/projects/:id/commits", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const { ref_name = "HEAD", page = "1" } = req.query;
    const data = await glFetch(
      `${url}/api/v4/projects/${encodeURIComponent(req.params.id)}/repository/commits?ref_name=${encodeURIComponent(ref_name as string)}&per_page=30&page=${page}`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects/:id/pipelines
router.get("/projects/:id/pipelines", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const { page = "1" } = req.query;
    const data = await glFetch(
      `${url}/api/v4/projects/${encodeURIComponent(req.params.id)}/pipelines?per_page=20&page=${page}`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects/:id/merge_requests
router.get("/projects/:id/merge_requests", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const { state = "opened", page = "1" } = req.query;
    const data = await glFetch(
      `${url}/api/v4/projects/${encodeURIComponent(req.params.id)}/merge_requests?state=${state}&per_page=20&page=${page}`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gitlab/projects/:id/issues
router.get("/projects/:id/issues", async (req, res) => {
  try {
    const { url, token } = await getGLConfig();
    if (!token) return res.status(401).json({ error: "GitLab not configured" });
    const { state = "opened", page = "1" } = req.query;
    const data = await glFetch(
      `${url}/api/v4/projects/${encodeURIComponent(req.params.id)}/issues?state=${state}&per_page=20&page=${page}`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
