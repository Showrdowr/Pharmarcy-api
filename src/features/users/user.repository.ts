import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, NewUser, User } from '../../db/schema/users.js';

export const userRepository = {
  async findAll(): Promise<User[]> {
    return db.select().from(users);
  },

  async findById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async findByFullName(fullName: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.fullName, fullName));
    return user;
  },

  async create(data: NewUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  async update(id: number, data: Partial<NewUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.count ?? 0) > 0;
  },
};
