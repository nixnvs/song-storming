// apps/web/api/[[...route]].ts
import app from './_app';

export const config = { runtime: 'nodejs' };
export default app.fetch;