import { request } from "./client";
import type { Project, ProjectDetail } from "./types";

export function listProjects(signal?: AbortSignal): Promise<Project[]> {
  return request<Project[]>("/projects", { signal });
}

export function getProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/${projectId}`, { signal });
}

export function createProject(input: {
  name: string;
  slug?: string;
  description?: string;
}): Promise<Project> {
  return request<Project>("/projects", { method: "POST", body: input });
}

export function updateProject(
  projectId: string,
  input: { name?: string; slug?: string; description?: string },
): Promise<Project> {
  return request<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteProject(projectId: string): Promise<{ message: string }> {
  return request(`/projects/${projectId}`, { method: "DELETE" });
}
