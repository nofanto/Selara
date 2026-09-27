import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SECTIONS } from './guideSections';

const GUIDE = join(__dirname, '../../docs/user-guide');

const pagesOnDisk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? pagesOnDisk(join(dir, entry.name))
    : entry.name.endsWith('.md') ? [relative(GUIDE, join(dir, entry.name)).replace(/\.md$/, '')] : []);

describe('the in-app guide sidebar', () => {
  const sidebar = SECTIONS.flatMap(section => section.pages.map(page => page.path));

  it('lists every guide page on disk, so none is unreachable in the app', () => {
    // The index is the README, which the sidebar does not show as a page.
    const onDisk = pagesOnDisk(GUIDE).filter(path => path !== 'README');
    expect(onDisk.length).toBeGreaterThan(50); // guard: the walk found the guide
    expect(onDisk.filter(path => !sidebar.includes(path)).sort()).toEqual([]);
  });

  it('points only at pages that exist', () => {
    expect(sidebar.filter(path => !existsSync(join(GUIDE, `${path}.md`)))).toEqual([]);
  });
});
