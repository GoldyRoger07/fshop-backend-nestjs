import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/** Tableau de bord back-office (SPEC §12). */
@Roles(UserRole.ADMIN)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  dashboard() {
    return this.statsService.getDashboard();
  }
}
