import * as THREE from "three";

class CurvePath {
  private transformers: Record<string, any>;
  private pipelines: Record<string, any>;
  private state: Record<string, any>;
  private updateFunction: ((points: THREE.Vector3[]) => THREE.Vector3[]) | null;
  private nextUpdateFunction:
    | ((points: THREE.Vector3[]) => THREE.Vector3[])
    | null;
  private points: THREE.Vector3[];

  constructor(
    readonly initialPoints: THREE.Vector3[],
    readonly divisions: number
  ) {
    this.initialPoints = this.subdividePoints(initialPoints);
    this.divisions = divisions;

    this.points = this.subdividePoints(initialPoints); // Updated points after updateFunction was called

    this.transformers = {};
    this.pipelines = {};
    this.state = {
      timeElapsed: 0,
      stateTransferProgress: 1,
    };

    this.updateFunction = null;
    this.nextUpdateFunction = null;
  }

  private subdividePoints(points: THREE.Vector3[]) {
    const curve = new THREE.CatmullRomCurve3(points);
    return curve.getSpacedPoints(this.divisions);
  }

  public update(timeElapsed: number) {
    if (this.updateFunction === null) throw Error("No pipline defined");

    this.state.timeElapsed = timeElapsed;

    // Change this so that animation durations can be supported
    if (this.nextUpdateFunction !== null) {
      this.state.stateTransferProgress -= 0.01;

      if (this.state.stateTransferProgress <= 0) {
        this.state.stateTransferProgress = 1;
        this.updateFunction = this.nextUpdateFunction;
        this.nextUpdateFunction = null;
      }
    }

    this.points = this.updateFunction(this.initialPoints);
  }

  public setPipeline(name: string) {
    this.nextUpdateFunction = this.pipelines[name];
  }

  public definePipeline(
    name: string,
    transformers: string[],
    isDefault: boolean = false
  ) {
    this.pipelines[name] = (points: THREE.Vector3[]) =>
      transformers.reduce(
        (points, transformerName) => this.transformers[transformerName](points),
        points.map((point) => point.clone())
      );

    if (isDefault) {
      this.updateFunction = this.pipelines[name];
    }
  }

  public addPointsTransformer(
    name: string,
    transformerFn: (
      point: THREE.Vector3,
      state: CurvePath["state"]
    ) => THREE.Vector3
  ) {
    this.transformers[name] = (points: THREE.Vector3[]) =>
      points.map((point) => transformerFn(point, this.state));
  }

  public getPoints() {
    return this.points;
  }
}

export default CurvePath;
