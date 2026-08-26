"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/ui/cx";

/**
 * Navegação do projeto. Quase tudo na plataforma pertence a um
 * projeto, então esta é a segunda camada da navegação — a primeira é
 * a lista de projetos.
 */

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const items: Item[] = [
    { href: base, label: "Visão geral", icon: <IconOverview /> },
    {
      href: `${base}/database`,
      label: "Banco de dados",
      icon: <IconDatabase />,
    },
    { href: `${base}/queries`, label: "Consultas", icon: <IconQuery /> },
    { href: `${base}/endpoints`, label: "Endpoints", icon: <IconEndpoint /> },
    { href: `${base}/api-keys`, label: "API Keys", icon: <IconKey /> },
    { href: `${base}/logs`, label: "Logs", icon: <IconLogs /> },
    { href: `${base}/openapi`, label: "OpenAPI", icon: <IconDoc /> },
  ];

  return (
    <nav aria-label="Seções do projeto" className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        // A visão geral é a raiz e casaria com tudo; as demais aceitam
        // subcaminhos para manter o item ativo em telas de detalhe.
        const active =
          item.href === base
            ? pathname === base
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
              active
                ? "bg-primary-soft font-medium text-primary"
                : "text-ink-muted hover:bg-muted hover:text-ink",
            )}
          >
            <span className="shrink-0 opacity-80">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* Ícones desenhados aqui para não acrescentar uma biblioteca inteira
   por sete traços. */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function IconOverview() {
  return (
    <Icon>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </Icon>
  );
}

function IconDatabase() {
  return (
    <Icon>
      <ellipse cx="8" cy="3.5" rx="5" ry="1.8" />
      <path d="M3 3.5v9c0 1 2.2 1.8 5 1.8s5-.8 5-1.8v-9" />
      <path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" />
    </Icon>
  );
}

function IconQuery() {
  return (
    <Icon>
      <path d="M5.5 5 3 8l2.5 3" />
      <path d="M10.5 5 13 8l-2.5 3" />
    </Icon>
  );
}

function IconEndpoint() {
  return (
    <Icon>
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="8" r="2" />
      <path d="M6 8h4" />
    </Icon>
  );
}

function IconKey() {
  return (
    <Icon>
      <circle cx="5" cy="8" r="2.5" />
      <path d="M7.5 8H14M12 8v2.5M10 8v1.5" />
    </Icon>
  );
}

function IconLogs() {
  return (
    <Icon>
      <path d="M3 4h10M3 8h10M3 12h6" />
    </Icon>
  );
}

function IconDoc() {
  return (
    <Icon>
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M9 2v3h3" />
    </Icon>
  );
}
