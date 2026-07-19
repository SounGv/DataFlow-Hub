import { Brand, PrismaClient } from '@prisma/client';
import { cleanText, sku as normSku } from '../normalize/normalizers';

/** Shop resolver — loads alias map once, resolves raw shop text → shop id. */
export class ShopResolver {
  private map = new Map<string, bigint>();

  static async load(prisma: PrismaClient): Promise<ShopResolver> {
    const r = new ShopResolver();
    const aliases = await prisma.shopAlias.findMany({ include: { shop: true } });
    for (const a of aliases) r.map.set(ShopResolver.norm(a.alias), a.shopId);
    const shops = await prisma.shop.findMany();
    for (const s of shops) r.map.set(ShopResolver.norm(s.name), s.id);
    return r;
  }

  private static norm(s: string): string {
    return s.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  resolve(raw: unknown): bigint | null {
    const s = cleanText(raw);
    if (!s) return null;
    return this.map.get(ShopResolver.norm(s)) ?? null;
  }
}

/** Product resolver — get-or-create by normalized SKU, in-memory cache. */
export class ProductResolver {
  private cache = new Map<string, bigint>();
  constructor(private prisma: PrismaClient) {}

  async resolve(raw: unknown, brand?: Brand): Promise<{ id: bigint | null; raw: string | null }> {
    const rawText = cleanText(raw);
    const s = normSku(raw).value;
    if (!s) return { id: null, raw: rawText };
    const hit = this.cache.get(s);
    if (hit) return { id: hit, raw: rawText };
    const p = await this.prisma.product.upsert({
      where: { sku: s },
      create: { sku: s, brand: brand ?? null },
      update: {},
    });
    this.cache.set(s, p.id);
    return { id: p.id, raw: rawText };
  }
}

/** Customer resolver — get-or-create by (phone, fullName). */
export class CustomerResolver {
  private cache = new Map<string, bigint>();
  constructor(private prisma: PrismaClient) {}

  async resolve(input: {
    fullName: string | null;
    chatName: string | null;
    phone: string | null;
    address: string | null;
  }): Promise<bigint | null> {
    if (!input.fullName && !input.phone) return null;
    const key = `${input.phone ?? ''}|${input.fullName ?? ''}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const c = await this.prisma.customer.upsert({
      where: { phone_fullName: { phone: input.phone ?? '', fullName: input.fullName ?? '' } },
      create: input,
      update: {
        chatName: input.chatName ?? undefined,
        address: input.address ?? undefined,
      },
    }).catch(async () => {
      // unique with NULLs: fall back to findFirst/create
      const found = await this.prisma.customer.findFirst({
        where: { phone: input.phone, fullName: input.fullName },
      });
      return found ?? this.prisma.customer.create({ data: input });
    });
    this.cache.set(key, c.id);
    return c.id;
  }
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
