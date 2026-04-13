import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { demoHttpSeedDisabledError } from '@/services/demo/demo-seed.service';

export async function POST() {
  return serviceErrorResponse(demoHttpSeedDisabledError(), 'Forbidden');
}
