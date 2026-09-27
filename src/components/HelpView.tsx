import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { SECTIONS } from '../lib/guideSections';

// All markdown files imported via Vite glob — keyed by their path relative to /docs/user-guide/
const MD_MODULES = import.meta.glob('/docs/user-guide/**/*.md', { query: '?raw', import: 'default' });

function mdKey(pagePath: string) {
  return `/docs/user-guide/${pagePath}.md`;
}

// Fix image paths from `../../public/features/foo.png` → `/features/foo.png`
function fixImagePaths(markdown: string): string {
  return markdown
    .replace(/\.\.\/\.\.\/public\/features\//g, '/features/')
    .replace(/\.\.\/\.\.\/public\/tutorial\//g, '/tutorial/');
}

// Strip nav links at the bottom (lines starting with "- Previous:" or "- Next:")
function stripNavLinks(markdown: string): string {
  return markdown.replace(/^- (Previous|Next):.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HelpView() {
  const [activePath, setActivePath] = useState(SECTIONS[0].pages[0].path);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(SECTIONS.map(s => s.title))
  );
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loader = MD_MODULES[mdKey(activePath)];
    if (!loader) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContent('Page not found.');
      setLoading(false);
      return;
    }
    (loader as () => Promise<string>)().then(raw => {
      setContent(fixImagePaths(stripNavLinks(raw as string)));
      setLoading(false);
      contentRef.current?.scrollTo({ top: 0 });
    });
    return () => setLoading(true);
  }, [activePath]);

  function toggleSection(title: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) { next.delete(title); } else { next.add(title); }
      return next;
    });
  }

  const activeSectionTitle = SECTIONS.find(s =>
    s.pages.some(p => p.path === activePath)
  )?.title;

  return (
    <div className="flex h-full overflow-hidden bg-white">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside data-testid="guide-sidebar" className="w-64 shrink-0 border-r border-slate-200 flex flex-col overflow-hidden bg-slate-50">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <BookOpen size={16} className="text-blue-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">User Guide</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {SECTIONS.map(section => {
            const isOpen = openSections.has(section.title);
            const isActive = section.title === activeSectionTitle;
            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {section.title}
                  {isOpen
                    ? <ChevronDown size={13} className="shrink-0" />
                    : <ChevronRight size={13} className="shrink-0" />}
                </button>
                {isOpen && (
                  <ul>
                    {section.pages.map(page => (
                      <li key={page.path}>
                        <button
                          onClick={() => setActivePath(page.path)}
                          className={`w-full text-left px-5 py-1.5 text-sm transition-colors ${
                            activePath === page.path
                              ? 'text-blue-700 font-medium bg-blue-50 border-r-2 border-blue-500'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          {page.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div ref={contentRef} data-testid="guide-content" className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Loading…
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Headings
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-slate-800 mt-8 mb-3">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-slate-700 mt-6 mb-2">{children}</h3>
                ),
                // Paragraphs
                p: ({ children }) => (
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">{children}</p>
                ),
                // Lists
                ul: ({ children }) => (
                  <ul className="list-disc list-outside pl-5 mb-4 space-y-1 text-sm text-slate-700">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside pl-5 mb-4 space-y-1 text-sm text-slate-700">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                // Code
                code: ({ className, children, ...props }) => {
                  const isBlock = className?.startsWith('language-');
                  return isBlock ? (
                    <code className="block bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-800 overflow-x-auto mb-4 whitespace-pre">
                      {children}
                    </code>
                  ) : (
                    <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                // Blockquote
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-200 pl-4 py-1 my-4 text-sm text-slate-600 italic bg-blue-50/40 rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                // Tables
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full text-sm border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-100 text-slate-700">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold border border-slate-200">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-sm border border-slate-200 text-slate-700">{children}</td>
                ),
                tr: ({ children }) => (
                  <tr className="even:bg-slate-50">{children}</tr>
                ),
                // Images
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt}
                    className="rounded-xl border border-slate-200 shadow-sm my-6 max-w-full"
                  />
                ),
                // Links — internal guide links navigate within the view
                a: ({ href, children }) => {
                  if (href && !href.startsWith('http')) {
                    // Resolve relative link to a guide path
                    const targetPath = href.replace(/\.md$/, '').replace(/^.*?(\d{2}-[^/]+\/.*)$/, '$1');
                    const allPages = SECTIONS.flatMap(s => s.pages);
                    const matched = allPages.find(p => p.path.endsWith(targetPath) || p.path === targetPath);
                    if (matched) {
                      return (
                        <button
                          onClick={() => setActivePath(matched.path)}
                          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
                        >
                          {children}
                        </button>
                      );
                    }
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline underline-offset-2">
                      {children}
                    </a>
                  );
                },
                // Horizontal rule
                hr: () => <hr className="my-8 border-slate-200" />,
                // Strong / em
                strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
