import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { hashPassword, verifyPassword } from './password-hash';

/** `passwordHash` nunca aparece em nenhuma resposta. */
const USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(dto.password),

        ...(dto.name !== undefined && { name: dto.name.trim() }),
      },

      select: USER_FIELDS,
    });

    return { accessToken: await this.signToken(user.id), user };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_FIELDS, passwordHash: true },
    });

    // A mesma resposta para e-mail inexistente e senha errada: informar
    // qual dos dois falhou permitiria descobrir quais e-mails existem.
    const senhaConfere =
      user !== null && (await verifyPassword(dto.password, user.passwordHash));

    if (!user || !senhaConfere) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // O hash foi carregado apenas para a conferência e não sai daqui.
    const seguro = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return { accessToken: await this.signToken(user.id), user: seguro };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_FIELDS,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return user;
  }

  /** O token carrega apenas o identificador do usuário. */
  private signToken(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId });
  }
}
