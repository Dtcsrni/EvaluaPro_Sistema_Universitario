export const esquemaIdAcademicoOpenApi = {
  type: 'string',
  pattern: '^\\s*(?:[0-9a-fA-F]{24}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\\s*$',
  description: 'ObjectId hexadecimal de 24 caracteres o UUID.'
};
