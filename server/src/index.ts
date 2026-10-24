import { createApp } from './app';
import { getDataset } from './services/data';

const port = Number(process.env.PORT ?? 3001);
const ds = getDataset();
createApp().listen(port, () => {
  console.log(`MedCheck API on :${port}`);
  console.log(`registry: ${ds.registry.total} products (snapshot ${ds.registry.snapshotDate}${ds.registry.isSeed ? ', SEED' : ''}); alerts: ${ds.alerts.length} (last ${ds.lastAlertDate})`);
});
