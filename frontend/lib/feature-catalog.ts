export type FrontendFeatureField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  description?: string;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
};

export type FrontendFeature = {
  code: string;
  name: string;
  description: string;
  taskType: string;
  resultType: string;
  fields: FrontendFeatureField[];
};

export const featureCatalog: FrontendFeature[] = [
  {
    code: 'fenjingtu',
    name: '分镜图',
    description: '输入剧情文本后快速生成分镜图，适合不熟悉底层工作流的新手直接使用。',
    taskType: 'image',
    resultType: 'image_group',
    fields: [
      {
        key: 'storyText',
        label: '剧情文本',
        type: 'textarea',
        required: true,
        placeholder: '请输入需要拆解成分镜图的剧情内容',
        description: '建议直接填写完整剧情段落，便于工作流拆分镜头。'
      },
      {
        key: 'visualStyle',
        label: '视觉风格',
        type: 'text',
        defaultValue: '电影感、角色统一、镜头连贯、氛围完整',
        placeholder: '例如：古风电影感、冷色调、宿命感'
      },
      {
        key: 'layoutMode',
        label: '分镜布局',
        type: 'select',
        defaultValue: '3x3',
        options: [
          { label: '3 x 3 九宫格', value: '3x3' },
          { label: '5 x 5 二十五宫格', value: '5x5' }
        ]
      },
      {
        key: 'outputRatio',
        label: '输出比例',
        type: 'select',
        defaultValue: '9:16',
        options: [
          { label: '9:16 竖版', value: '9:16' },
          { label: '1:1 方图', value: '1:1' },
          { label: '16:9 横版', value: '16:9' }
        ]
      }
    ]
  }
];

export function getFrontendFeature(code: string) {
  return featureCatalog.find((feature) => feature.code === code);
}
