import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { User, UserRole } from '../users/entities/user.entity';
import { Category } from '../categories/category.entity';
import { Product } from '../products/entities/product.entity';
import { ShippingZone } from '../shipping/shipping-zone.entity';
import { Review, ReviewStatus } from '../reviews/review.entity';

loadEnv();

/**
 * Seed idempotent : crée un admin, un client démo, des catégories/produits, des
 * zones de livraison et quelques avis à modérer. Relançable sans doublon.
 *
 *   npm run seed
 */
async function seed() {
  await dataSource.initialize();
  const users = dataSource.getRepository(User);
  const categories = dataSource.getRepository(Category);
  const products = dataSource.getRepository(Product);
  const zones = dataSource.getRepository(ShippingZone);
  const reviews = dataSource.getRepository(Review);

  // --- Comptes ---
  let admin = await users.findOne({ where: { email: 'admin@fshop.ht' } });
  if (!admin) {
    admin = await users.save(
      users.create({
        fullName: 'Admin Fshop',
        email: 'admin@fshop.ht',
        phone: '+50937000000',
        password: await bcrypt.hash('Admin123!', 10),
        role: UserRole.ADMIN,
      }),
    );
    console.log('✓ admin créé : admin@fshop.ht / Admin123!');
  }

  let customer = await users.findOne({ where: { email: 'client@fshop.ht' } });
  if (!customer) {
    customer = await users.save(
      users.create({
        fullName: 'Marie Client',
        email: 'client@fshop.ht',
        phone: '+50938000000',
        password: await bcrypt.hash('Client123!', 10),
        role: UserRole.CUSTOMER,
      }),
    );
    console.log('✓ client démo créé : client@fshop.ht / Client123!');
  }

  // --- Catégories ---
  const catDefs = [
    { name: 'Téléphones', slug: 'telephones', position: 1 },
    { name: 'Ordinateurs', slug: 'ordinateurs', position: 2 },
    { name: 'Accessoires', slug: 'accessoires', position: 3 },
  ];
  const catBySlug: Record<string, Category> = {};
  for (const def of catDefs) {
    let cat = await categories.findOne({ where: { slug: def.slug } });
    if (!cat) {
      cat = await categories.save(categories.create({ ...def, parentId: null }));
    }
    catBySlug[def.slug] = cat;
  }

  // --- Produits ---
  const prodDefs = [
    { name: 'iPhone 15', slug: 'iphone-15', cat: 'telephones', priceCents: 8500000, stock: 12, featured: true, description: 'Smartphone Apple 128 Go.' },
    { name: 'Samsung Galaxy A54', slug: 'samsung-galaxy-a54', cat: 'telephones', priceCents: 3200000, stock: 20, featured: true, description: 'Android 5G, bon rapport qualité/prix.' },
    { name: 'MacBook Air M2', slug: 'macbook-air-m2', cat: 'ordinateurs', priceCents: 12500000, stock: 6, featured: true, description: 'Ultraportable 13 pouces.' },
    { name: 'Dell Inspiron 15', slug: 'dell-inspiron-15', cat: 'ordinateurs', priceCents: 6800000, stock: 9, featured: false, description: 'Portable polyvalent.' },
    { name: 'Chargeur USB-C 30W', slug: 'chargeur-usb-c-30w', cat: 'accessoires', priceCents: 90000, stock: 50, featured: false, description: 'Charge rapide.' },
    { name: 'Écouteurs Bluetooth', slug: 'ecouteurs-bluetooth', cat: 'accessoires', priceCents: 250000, stock: 3, featured: true, description: 'Sans fil, autonomie 24h.' },
  ];
  const prodBySlug: Record<string, Product> = {};
  for (const def of prodDefs) {
    let prod = await products.findOne({ where: { slug: def.slug } });
    if (!prod) {
      prod = await products.save(
        products.create({
          name: def.name,
          slug: def.slug,
          description: def.description,
          priceCents: def.priceCents,
          stock: def.stock,
          imageUrl: `https://placehold.co/600x600?text=${encodeURIComponent(def.name)}`,
          isActive: true,
          featured: def.featured,
          categoryId: catBySlug[def.cat].id,
        }),
      );
    }
    prodBySlug[def.slug] = prod;
  }

  // --- Zones de livraison ---
  const zoneDefs = [
    { name: 'Port-au-Prince', feeCents: 25000, active: true },
    { name: 'Cap-Haïtien', feeCents: 40000, active: true },
    { name: 'Autres villes', feeCents: 60000, active: true },
  ];
  for (const def of zoneDefs) {
    const existing = await zones.findOne({ where: { name: def.name } });
    if (!existing) await zones.save(zones.create(def));
  }

  // --- Avis à modérer (démo) ---
  const reviewCount = await reviews.count();
  if (reviewCount === 0) {
    await reviews.save([
      reviews.create({
        productId: prodBySlug['iphone-15'].id,
        userId: customer.id,
        userName: customer.fullName,
        orderId: 0,
        rating: 5,
        title: 'Excellent',
        body: 'Téléphone au top, livraison rapide.',
        status: ReviewStatus.PENDING,
      }),
      reviews.create({
        productId: prodBySlug['ecouteurs-bluetooth'].id,
        userId: customer.id,
        userName: customer.fullName,
        orderId: 0,
        rating: 4,
        title: 'Bon son',
        body: 'Autonomie correcte, confortables.',
        status: ReviewStatus.PENDING,
      }),
    ]);
    console.log('✓ 2 avis en attente de modération');
  }

  console.log('Seed terminé.');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
