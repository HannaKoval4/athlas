import type { CultureGraph } from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';
import { CardType, RelationType } from '../../../generated/prisma/enums';

class GraphNodeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'parthenon' })
  slug: string;

  @ApiProperty({ example: 'Парфенон' })
  title: string;

  @ApiProperty({ enum: CardType })
  type: CardType;

  @ApiProperty({ type: String, nullable: true })
  imageUrl: string | null;
}

class GraphEdgeDto {
  @ApiProperty({ format: 'uuid' })
  fromId: string;

  @ApiProperty({ format: 'uuid' })
  toId: string;

  @ApiProperty({ enum: RelationType })
  relationType: RelationType;
}

export class CultureGraphDto implements CultureGraph {
  @ApiProperty({ type: [GraphNodeDto] })
  nodes: GraphNodeDto[];

  @ApiProperty({ type: [GraphEdgeDto] })
  edges: GraphEdgeDto[];
}
