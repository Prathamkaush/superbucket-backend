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

function hasRole(user: any, roles: string[]) {
  return Boolean(user?.role && roles.includes(user.role));
}

@Injectable()
export class AdminOrSubAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.method === "OPTIONS") return true;

    if (!hasRole(req.user, ["ADMIN", "SUB_ADMIN"])) {
      throw new ForbiddenException("Admin or sub-admin access only");
    }

    return true;
  }
}

@Injectable()
export class AdminStaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.method === "OPTIONS") return true;

    if (!hasRole(req.user, ["ADMIN", "SUB_ADMIN", "PICKER"])) {
      throw new ForbiddenException("Staff access only");
    }

    return true;
  }
}

@Injectable()
export class AdminOrPickerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.method === "OPTIONS") return true;

    if (!hasRole(req.user, ["ADMIN", "PICKER"])) {
      throw new ForbiddenException("Admin or picker access only");
    }

    return true;
  }
}
