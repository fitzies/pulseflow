import { readdir, readFile } from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';

async function getGuides() {
  const guidesDir = path.join(process.cwd(), 'public', 'guides');
  let files: string[];
  try {
    files = await readdir(guidesDir);
  } catch {
    return [];
  }

  const guides = await Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .map(async (file) => {
        const slug = file.replace('.md', '');
        const content = await readFile(path.join(guidesDir, file), 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : slug;

        const withoutTitle = content.replace(/^#\s+.+$/m, '').trim();
        const firstParagraph = withoutTitle.split(/\n\n+/)[0] ?? '';
        const descMatch = firstParagraph.match(/^[^.!?]*[.!?]/);
        const description = descMatch ? descMatch[0].trim() : firstParagraph.slice(0, 120);

        return { slug, title, description };
      })
  );
  return guides;
}

export default async function GuidesPage() {
  const guides = await getGuides();

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Guides</h1>
      <div className="divide-y divide-border rounded-2xl border border-border">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`guides/${guide.slug}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted group"
          >
            <div className="min-w-0">
              <p className="text-lg font-medium text-foreground truncate">
                {guide.title}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {guide.description}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
