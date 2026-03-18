import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateFeatureTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsObject()
  inputParams!: Record<string, unknown>;
}
