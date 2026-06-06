import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
     if (req.method === "OPTIONS") {
      return true;
    }
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access only');
    }

    return true;
  }
}
