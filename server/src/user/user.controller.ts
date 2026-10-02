import { Controller, Get, Patch, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, UserStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.userService.findAll();
  }

  @Get('pending-count')
  @Roles('ADMIN')
  async getPendingCount() {
    const count = await this.userService.getPendingCount();
    return { count };
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() data: { status?: UserStatus; role?: Role }
  ) {
    // Prevent admins from revoking their own access
    if (data.status === 'REJECTED' && req.user.id === +id) {
      throw new ForbiddenException('You cannot revoke your own access.');
    }
    return this.userService.update(+id, data);
  }
}
