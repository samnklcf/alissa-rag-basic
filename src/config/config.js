import "dotenv/config";

// Configuration centralisée : on lit les variables d'environnement à un seul
// endroit, ce qui facilite la maintenance et les tests.
export const config = {
  turso: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  openai: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  server: {
    port: process.env.PORT || 3000,
  },
};
