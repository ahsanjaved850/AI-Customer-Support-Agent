import { initSchema } from '../lib/db.js';
import { createAdminUser, createCompany, getCompanyBySlug } from '../lib/companies.js';

/**
 * One-time provisioning script — the only way to create a new company right
 * now (no public signup endpoint). Run from the server package:
 *
 *   npm run create-company -- --slug=acme --name="Acme Inc" --username=admin --password=secret
 */
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function main(): void {
  initSchema();

  const { slug, name, username, password } = parseArgs();
  if (!slug || !name || !username || !password) {
    console.error(
      'Usage: npm run create-company -- --slug=acme --name="Acme Inc" --username=admin --password=secret',
    );
    process.exit(1);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error('slug must contain only lowercase letters, digits, and hyphens');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('password must be at least 8 characters');
    process.exit(1);
  }
  if (getCompanyBySlug(slug)) {
    console.error(`A company with slug "${slug}" already exists`);
    process.exit(1);
  }

  const company = createCompany({ slug, name });
  createAdminUser(company.id, username, password);

  console.log(`Created company "${name}" (slug: ${slug}) with admin user "${username}".`);
  console.log(`Chat URL:  /c/${slug}`);
  console.log(`Admin URL: /admin/${slug}`);
}

main();
