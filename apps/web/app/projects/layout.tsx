import { RequireAuth } from "@/components/shell/require-auth";

/** Tudo abaixo de /projects exige sessão. */
export default function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  return <RequireAuth>{children}</RequireAuth>;
}
