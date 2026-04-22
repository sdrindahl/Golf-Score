export interface ChildCourse {
  id: string;
  name: string;
  location: string;
  state: string;
  holeCount: number;
  par?: number;
  parent_id: string;
  holes: any[];
}
