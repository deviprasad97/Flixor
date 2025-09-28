import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'json', nullable: true })
  plexServers?: Array<{
    id: string;
    name: string;
    host: string;
    port: number;
    protocol: 'http' | 'https';
    owned: boolean;
    publicAddress?: string;
    localAddresses?: string[];
    accessToken: string; // encrypted
  }>;

  @Column({ type: 'varchar', nullable: true })
  currentServerId?: string;

  @Column({ type: 'text', nullable: true, select: false })
  tmdbApiKey?: string;

  @Column({ type: 'json', nullable: true })
  tmdbApiUsage?: {
    dailyRequests: number;
    resetAt: Date;
    isCustomKey: boolean;
  };

  @Column({ type: 'json', nullable: true, select: false })
  traktTokens?: any;

  @Column({ type: 'json', nullable: true })
  preferences?: {
    language?: string;
    autoPlay?: boolean;
    quality?: string;
    subtitles?: boolean;
    theme?: string;
  };

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => User, user => user.settings)
  @JoinColumn({ name: 'userId' })
  user!: User;
}
