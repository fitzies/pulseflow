import { readdir, readFile } from 'fs/promises';
import path from 'path';
import Link from 'next/link';

async function getGuides() {
  const guidesDir = path.join(process.cwd(), 'public', 'guides');
  const files = await readdir(guidesDir);

  const guides = await Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .map(async (file) => {
        const slug = file.replace('.md', '');
        const content = await readFile(path.join(guidesDir, file), 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : slug;

        return { slug, title };
      })
  );

  return guides;
}

export default async function GuidesPage() {
  const guides = await getGuides();

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Guides</h1>
      <div className="space-y-4">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="block p-4 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <h2 className="text-lg font-medium">{guide.title}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
