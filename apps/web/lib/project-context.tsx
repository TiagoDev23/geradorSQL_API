"use client";

import { createContext, useContext } from "react";

import type { ProjectDetail } from "./api/types";

/**
 * Projeto atual, carregado uma vez pelo layout e reaproveitado pelas
 * páginas da seção. Não é estado global da aplicação: vive apenas
 * enquanto a rota do projeto está aberta.
 */
interface ProjectContextValue {
  project: ProjectDetail;
  /** Recarrega o projeto após uma alteração que muda suas contagens. */
  reload: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export const ProjectProvider = ProjectContext.Provider;

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error("useProject precisa estar dentro da rota de um projeto.");
  }

  return context;
}
