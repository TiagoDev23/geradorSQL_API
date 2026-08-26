"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import * as projectsApi from "@/lib/api/projects";
import type { ProjectDetail } from "@/lib/api/types";
import { errorMessage } from "@/lib/use-resource";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/** Ações sobre o próprio projeto, fora do fluxo principal da visão geral. */
export function ProjectSettings({
  project,
  onSaved,
}: {
  project: ProjectDetail;
  onSaved: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();

  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
        Excluir
      </Button>

      <Button size="sm" onClick={() => setEditing(true)}>
        Editar
      </Button>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar projeto"
        description="Alterar o slug muda a URL pública dos endpoints."
      >
        {/* Montado só enquanto o diálogo está aberto: reabrir recomeça
            dos valores atuais do projeto. */}
        <ProjectForm
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved();
            notify("Projeto atualizado.");
          }}
        />
      </Dialog>

      <ConfirmDialog
        open={removing}
        title="Excluir projeto"
        description={`O projeto "${project.name}" e tudo que pertence a ele serão removidos.`}
        confirmLabel="Excluir projeto"
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          await projectsApi.deleteProject(project.id);

          notify("Projeto removido.");
          router.replace("/projects");
        }}
      />
    </>
  );
}

function ProjectForm({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError(null);

    try {
      await projectsApi.updateProject(project.id, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
      });

      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome" htmlFor="edit-project-name" required>
        <Input
          id="edit-project-name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <Field label="Slug" htmlFor="edit-project-slug" required>
        <Input
          id="edit-project-slug"
          mono
          required
          maxLength={80}
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
      </Field>

      <Field label="Descrição" htmlFor="edit-project-description">
        <Textarea
          id="edit-project-description"
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
          Salvar
        </Button>
      </div>
    </form>
  );
}
