import { request } from "./client";
import type { AuthResult, User } from "./types";

export function signup(input: {
  name?: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  return request<AuthResult>("/auth/signup", {
    method: "POST",
    body: input,
    anonymous: true,
  });
}

export function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  return request<AuthResult>("/auth/login", {
    method: "POST",
    body: input,
    anonymous: true,
  });
}

export function me(signal?: AbortSignal): Promise<User> {
  return request<User>("/auth/me", { signal });
}
