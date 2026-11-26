using Npgsql;

namespace Shortlet.Api.Helpers
{
    public static class DatabaseConnection
    {
        /// <summary>
        /// Makes the connection string fast and safe for a remote (e.g. Supabase) database:
        /// <list type="bullet">
        /// <item>Connection pooling ON. Opening a new TLS connection to a remote Postgres costs ~0.5–2 s;
        ///   with pooling off (as it was) every single query paid that cost.</item>
        /// <item>One connection kept warm, plus TCP keepalives so idle connections aren't silently dropped.</item>
        /// <item>For Supabase's transaction pooler (PgBouncer, port 6543): no prepared statements and no
        ///   session reset on close, which PgBouncer's transaction mode doesn't support.</item>
        /// </list>
        /// Returns the tuned string and a description of what changed (for the startup log).
        /// </summary>
        public static (string ConnectionString, List<string> Changes) Tune(string connectionString)
        {
            var b = new NpgsqlConnectionStringBuilder(connectionString);
            var changes = new List<string>();

            if (!b.Pooling) { b.Pooling = true; changes.Add("Pooling=true"); }
            if (b.MinPoolSize < 1) { b.MinPoolSize = 1; changes.Add("Minimum Pool Size=1"); }
            if (b.KeepAlive == 0) { b.KeepAlive = 30; changes.Add("Keepalive=30"); }

            var isLocal = b.Host is "localhost" or "127.0.0.1" or "::1";
            var isTransactionPooler = b.Port == 6543 || (b.Host?.Contains("pooler.", StringComparison.OrdinalIgnoreCase) == true && b.Port != 5432);
            if (!isLocal && isTransactionPooler)
            {
                if (!b.NoResetOnClose) { b.NoResetOnClose = true; changes.Add("No Reset On Close=true"); }
                if (b.MaxAutoPrepare != 0) { b.MaxAutoPrepare = 0; changes.Add("Max Auto Prepare=0"); }
            }

            return (b.ConnectionString, changes);
        }
    }
}
