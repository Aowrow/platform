import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  featureCode!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsObject()
  inputParams!: Record<string, unknown>;
}
