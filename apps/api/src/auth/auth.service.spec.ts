import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './password-hash';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SENHA = 'senha-bem-secreta';

function buildPrismaMock() {
  return {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

interface PrismaCallArgs {
  data: Record<string, unknown>;
  select: Record<string, unknown>;
  where: Record<string, unknown>;
}

function firstCallArgs(mock: jest.Mock): PrismaCallArgs {
  const calls = mock.mock.calls as unknown as PrismaCallArgs[][];

  return calls[0][0];
}

describe('password-hash', () => {
  it('não guarda a senha em texto puro', async () => {
    const hash = await hashPassword(SENHA);

    expect(hash).not.toContain(SENHA);
  });

  it('gera hashes distintos para a mesma senha', async () => {
    // O sal é aleatório: duas contas com a mesma senha não compartilham
    // hash.
    expect(await hashPassword(SENHA)).not.toBe(await hashPassword(SENHA));
  });

  it('confere a senha correta', async () => {
    expect(await verifyPassword(SENHA, await hashPassword(SENHA))).toBe(true);
  });

  it('recusa senha errada', async () => {
    expect(await verifyPassword('outra', await hashPassword(SENHA))).toBe(
      false,
    );
  });

  it('recusa hash malformado sem lançar erro', async () => {
    expect(await verifyPassword(SENHA, 'formato-invalido')).toBe(false);
    expect(await verifyPassword(SENHA, 'abc:def')).toBe(false);
  });
});

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    jwt = { signAsync: jest.fn().mockResolvedValue('token-assinado') };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: USER_ID,
      name: 'Pessoa',
      email: 'pessoa@exemplo.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('signup', () => {
    it('armazena a senha como hash, nunca em texto puro', async () => {
      await service.signup({ email: 'Pessoa@Exemplo.com', password: SENHA });

      const { data } = firstCallArgs(prisma.user.create);

      expect(data.passwordHash).not.toBe(SENHA);
      expect(JSON.stringify(data)).not.toContain(SENHA);
      expect(await verifyPassword(SENHA, data.passwordHash as string)).toBe(
        true,
      );
    });

    it('normaliza o e-mail para minúsculas', async () => {
      await service.signup({ email: 'Pessoa@Exemplo.com', password: SENHA });

      expect(firstCallArgs(prisma.user.create).data.email).toBe(
        'pessoa@exemplo.com',
      );
    });

    it('não retorna passwordHash', async () => {
      const resultado = await service.signup({
        email: 'pessoa@exemplo.com',
        password: SENHA,
      });

      expect(JSON.stringify(resultado)).not.toContain('passwordHash');
      expect(firstCallArgs(prisma.user.create).select).not.toHaveProperty(
        'passwordHash',
      );
    });

    it('devolve token de acesso', async () => {
      const resultado = await service.signup({
        email: 'pessoa@exemplo.com',
        password: SENHA,
      });

      expect(resultado.accessToken).toBe('token-assinado');
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: USER_ID });
    });

    it('recusa e-mail já cadastrado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'outro' });

      await expect(
        service.signup({ email: 'pessoa@exemplo.com', password: SENHA }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    async function mockUsuario(senha = SENHA) {
      prisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        name: 'Pessoa',
        email: 'pessoa@exemplo.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: await hashPassword(senha),
      });
    }

    it('autentica com credenciais corretas', async () => {
      await mockUsuario();

      const resultado = await service.login({
        email: 'pessoa@exemplo.com',
        password: SENHA,
      });

      expect(resultado.accessToken).toBe('token-assinado');
      expect(resultado.user.email).toBe('pessoa@exemplo.com');
    });

    it('não devolve passwordHash', async () => {
      await mockUsuario();

      const resultado = await service.login({
        email: 'pessoa@exemplo.com',
        password: SENHA,
      });

      expect(JSON.stringify(resultado)).not.toContain('passwordHash');
      expect(resultado.user).not.toHaveProperty('passwordHash');
    });

    it('recusa senha incorreta', async () => {
      await mockUsuario();

      await expect(
        service.login({ email: 'pessoa@exemplo.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('usa a mesma mensagem para e-mail inexistente e senha errada', async () => {
      await mockUsuario();

      const erroSenha: unknown = await service
        .login({ email: 'pessoa@exemplo.com', password: 'errada' })
        .catch((e: unknown) => e);

      prisma.user.findUnique.mockResolvedValue(null);

      const erroEmail: unknown = await service
        .login({ email: 'ninguem@exemplo.com', password: SENHA })
        .catch((e: unknown) => e);

      // Mensagens iguais impedem descobrir quais e-mails estão
      // cadastrados.
      expect((erroSenha as Error).message).toBe((erroEmail as Error).message);
    });
  });

  describe('me', () => {
    it('devolve o usuário sem campos sensíveis', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        name: 'Pessoa',
        email: 'pessoa@exemplo.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const resultado = await service.me(USER_ID);

      expect(resultado.id).toBe(USER_ID);
      expect(resultado).not.toHaveProperty('passwordHash');
    });

    it('rejeita usuário inexistente', async () => {
      await expect(service.me(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
