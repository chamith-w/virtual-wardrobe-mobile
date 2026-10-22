const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle migrations ship as .sql files.
config.resolver.sourceExts.push('sql');

// Babel inlines each migration's SQL into migrations.js, so Metro's on-disk
// cache (keyed on migrations.js alone) never notices a .sql edit and keeps
// serving the old SQL, even across restarts. Keying the cache on the SQL
// itself means restarting Metro is enough to pick up a new or edited migration.
const migrations = path.join(__dirname, 'src/db/migrations');
const sqlFiles = fs.readdirSync(migrations).filter((f) => f.endsWith('.sql'));
const sql = createHash('sha1');
for (const file of sqlFiles.sort()) sql.update(file).update(fs.readFileSync(path.join(migrations, file)));
config.cacheVersion = `${config.cacheVersion}+sql.${sql.digest('hex').slice(0, 12)}`;

module.exports = withNativeWind(config, {
  input: './src/global.css',
  configPath: './tailwind.config.ts',
});
