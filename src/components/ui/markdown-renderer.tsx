"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--app-body-text)", lineHeight: 1.3 }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--app-body-text)", lineHeight: 1.3 }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.375rem", color: "var(--app-body-text)" }}>{children}</h3>
  ),
  p: ({ children }) => (
    <p style={{ marginBottom: "0.6rem", lineHeight: 1.65, color: "var(--app-body-text)" }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ listStyleType: "disc", paddingLeft: "1.5rem", marginBottom: "0.6rem" }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ listStyleType: "decimal", paddingLeft: "1.5rem", marginBottom: "0.6rem" }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: "0.2rem", color: "var(--app-body-text)" }}>{children}</li>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600, color: "var(--app-body-text)" }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: "italic" }}>{children}</em>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.startsWith("language-"));
    if (isBlock) {
      return <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.8125rem" }}>{children}</code>;
    }
    return (
      <code style={{
        backgroundColor: "rgba(128,128,255,0.15)",
        padding: "0.1rem 0.35rem",
        borderRadius: "0.25rem",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.8125rem",
        color: "var(--app-body-text)",
      }}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre style={{
      backgroundColor: "rgba(0,0,0,0.25)",
      padding: "0.75rem 1rem",
      borderRadius: "0.375rem",
      overflowX: "auto",
      marginBottom: "0.75rem",
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "0.8125rem",
      lineHeight: 1.6,
    }}>
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: "3px solid var(--app-border)",
      paddingLeft: "0.875rem",
      color: "var(--app-text-muted)",
      fontStyle: "italic",
      marginBottom: "0.75rem",
    }}>
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr style={{ borderColor: "var(--app-border)", marginTop: "0.75rem", marginBottom: "0.75rem" }} />
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#fd1384", textDecoration: "underline" }}
    >
      {children}
    </a>
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
