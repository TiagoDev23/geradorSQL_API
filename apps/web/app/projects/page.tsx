"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import * as projectsApi from "@/lib/api/projects";
import { formatRelative, previewSlug } from "@/lib/format";
import { errorMessage, useResource } from "@/lib/use-resource";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, FormError } from "@/components/ui/states";

export default function ProjectsPage() {
  const [creating, setCreating] = useState(false);

  const projects = useResource(
    useCallback((signal: AbortSignal) => projectsApi.listProjects(signal), []),
  );

  return (
    <AppShell>
      <PageHeader
        title="Projetos"
        description="Cada projeto reúne conexões, consultas e endpoints."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Novo projeto
          </Button>
        }
      />

      <div className="mt-6">
        {projects.loading ? (
          <SkeletonRows rows={3} className="[&>*]:h-20" />
        ) : projects.error ? (
          <ErrorState message={projects.error} onRetry={projects.reload} />
        ) : projects.data && projects.data.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.data.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-muted/40"
                >
                  <p className="truncate text-sm font-medium text-ink">
                    {project.name}
                  </p>

                  <p className="mt-0.5 truncate font-mono text-[12.5px] text-ink-muted">
                    {project.slug}
                  </p>

                  {project.description ? (
                    <p className="mt-2 line-clamp-2 text-[13px] text-ink-muted">
                      {project.description}
                    </p>
                  ) : null}

                  <p className="mt-auto pt-3 text-[12px] text-ink-subtle">
                    atualizado {formatRelative(project.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhum projeto ainda."
            description="Crie um projeto para conectar um banco e publicar endpoints."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Criar projeto
              </Button>
            }
          />
        )}
      </div>

      <CreateProjectDialog open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}

function CreateProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError(null);

    try {
      const project = await projectsApi.createProject({
        name: name.trim(),
        ...(slug.trim() && { slug: slug.trim() }),
        ...(description.trim() && { description: description.trim() }),
      });

      // O projeto recém-criado abre direto: é para lá que o usuário vai.
      router.push(`/projects/${project.id}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo projeto"
      description="O slug compõe a URL pública dos endpoints."
    >
      <form
        id="create-project"
        onSubmit={submit}
        className="flex flex-col gap-4"
      >
        <Field label="Nome" htmlFor="project-name" required>
          <Input
            id="project-name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="Slug"
          htmlFor="project-slug"
          hint={
            slug.trim() || name.trim() ? (
              <>
                URL:{" "}
                <span className="font-mono">
                  /runtime/{previewSlug(slug || name) || "—"}/v1/…
                </span>
              </>
            ) : (
              "Derivado do nome quando em branco."
            )
          }
        >
          <Input
            id="project-slug"
            mono
            maxLength={80}
            placeholder={previewSlug(name)}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </Field>

        <Field label="Descrição" htmlFor="project-description">
          <Textarea
            id="project-description"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>

          <Button type="submit" variant="primary" loading={busy}>
            Criar projeto
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
