import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('cache_entries')
export class CacheEntry {
  @PrimaryColumn({ type: 'varchar', length: 500 })
  key!: string;

  @Column({ type: 'json' })
  value!: any;

  @Column({ type: 'integer' })
  @Index()
  ttl!: number;

  @Column({ type: 'datetime' })
  @Index()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}