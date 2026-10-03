import { FastifyPluginAsync } from 'fastify';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const botlabRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { scenario: string, humans?: number, bots?: number, durationSec?: number, rps?: number } }>(
    '/admin/botlab/run',
    async (request, reply) => {
      const { scenario, humans = 100, bots = 10, durationSec = 10, rps = 50 } = request.body;
      
      const runId = `run_${Date.now()}`;
      const botlabPath = path.resolve(__dirname, '../../../../tools/botlab/index.ts');
      const reportsDir = path.resolve(__dirname, '../../../../reports');
      
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      fastify.log.info(`Spawning botlab run ${runId} for scenario ${scenario}`);

      // We run botlab as an independent process so we don't block the API event loop
      const child = spawn('npx', [
        'tsx', botlabPath,
        '--scenario', scenario,
        '--humans', humans.toString(),
        '--bots', bots.toString(),
        '--durationSec', durationSec.toString(),
        '--rps', rps.toString(),
        '--runId', runId
      ]);

      child.stdout.on('data', (data) => fastify.log.info(`[Botlab ${runId}]: ${data}`));
      child.stderr.on('data', (data) => fastify.log.error(`[Botlab ${runId}]: ${data}`));

      return reply.send({ success: true, runId, message: 'Botlab swarm initialized in background' });
    }
  );
};

export default botlabRoutes;
