import { Entity, PrimaryColumn, Column, Index, DeleteDateColumn } from 'typeorm';
import { ISession } from 'connect-typeorm';

@Entity('sessions')
export class Session implements ISession {
  @PrimaryColumn('varchar', { length: 255 })
  id!: string;

  @Index()
  @Column('bigint')
  expiredAt!: number;

  @Column('text')
  json!: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}