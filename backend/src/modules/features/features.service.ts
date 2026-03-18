import { Injectable, NotFoundException } from '@nestjs/common';
import { getFeatureDefinition, getFeatureDefinitions } from './feature-registry';

@Injectable()
export class FeaturesService {
  findAll() {
    return getFeatureDefinitions().map((feature) => ({
      code: feature.code,
      name: feature.name,
      description: feature.description,
      taskType: feature.taskType,
      resultType: feature.resultType,
      fields: feature.fields
    }));
  }

  findOne(code: string) {
    const feature = getFeatureDefinition(code);

    if (!feature) {
      throw new NotFoundException('Feature not found.');
    }

    return {
      code: feature.code,
      name: feature.name,
      description: feature.description,
      taskType: feature.taskType,
      resultType: feature.resultType,
      fields: feature.fields
    };
  }
}
