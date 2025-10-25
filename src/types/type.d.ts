interface LevelDefinition {
  id: number
  name?: string
  gridSize: {
    rows: number
    cols: number
  }
  cardKinds: number
  minMatch: number
  trapRate: number
  timeLimit?: number
  moveLimit?: number
  targetScore: number
  shuffles: number
  hints: number
  comboBonus: number
}

interface GameConfig {
  container?: Ref<HTMLElement | undefined>   // cardNode容器
  cardNum?: number                           // card类型数量
  gridSize?: {                               // 网格大小
    rows: number
    cols: number
  }
  layerNum?: number                          // 图层数量
  trap?: boolean                             // 是否包含陷阱
  minMatch?: number                          // 最小匹配数量
  delNode?: boolean                          // 是否从nodes中剔除已选节点
  sound?: boolean                            // 是否开启音效
  levelIndex?: number                        // 初始关卡
  levels?: LevelDefinition[]                 // 自定义关卡列表
  events?: GameEvents                        // 游戏事件
}

interface GameEvents {
  clickCallback?: () => void
  dropCallback?: () => void
  winCallback?: (score: number, payload?: any) => void  // 胜利回调
  loseCallback?: (score: number, payload?: any) => void
  scoreCallback?: (score: number, payload?: any) => void // 得分更新回调
  levelChangeCallback?: (payload: { level: LevelDefinition; index: number }) => void
  shuffleCallback?: (payload: { shufflesLeft: number }) => void
  hintCallback?: (payload: { hintsLeft: number }) => void
}

// 卡片节点类型
type CardNode = {
  id: string           // 节点id zIndex-index
  type: number         // 类型
  sprite?: string      // 显示用 1x 资源
  sprite2x?: string    // 显示用 2x 资源
  isTrap?: boolean     // 是否为陷阱卡
  isHinted?: boolean   // 是否处于提示状态
  zIndex: number       // 图层
  index: number        // 所在图层中的索引
  parents: CardNode[]  // 父节点
  row: number          // 行
  column: number       // 列
  top: number          // 顶部位置
  left: number         // 左侧位置
  state: number        // 状态 0：无状态 1：可点击 2：已选 3：已消除
  removeTime?: number  // 消除时间戳
  dropDistance?: number // 下落距离
  isNew?: boolean      // 是否为新卡片
}

interface Game {
  nodes: Ref<CardNode[]>;
  selectedNodes: Ref<CardNode[]>;
  removeList: Ref<CardNode[]>;
  removeFlag: Ref<boolean>;
  backFlag: Ref<boolean>;
  score: Ref<number>;               // 当前总得分
  levelScore: Ref<number>;          // 当前关卡得分
  levelIndex: Ref<number>;
  currentLevel: ComputedRef<LevelDefinition>;
  levels: LevelDefinition[];
  targetScore: ComputedRef<number>;
  comboStreak: Ref<number>;
  comboBonus: Ref<number>;
  remainingTime: Ref<number | null>;
  remainingMoves: Ref<number | null>;
  shufflesLeft: Ref<number>;
  hintsLeft: Ref<number>;
  lastResult: Ref<'win' | 'lose' | null>;
  isGameOver: Ref<boolean>;        // 游戏是否结束
  isPaused: Ref<boolean>;          // 游戏是否暂停
  isSoundEnabled: Ref<boolean>;    // 音效是否开启
  handleSelect: (node: CardNode) => void;
  handleSelectRemove: (node: CardNode) => void;
  handleBack: () => void;
  handleRemove: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;         // 切换暂停状态
  toggleSound: () => void;         // 切换音效状态
  restart: () => void;             // 重新开始游戏（当前关卡）
  retryLevel: () => void;
  nextLevel: () => void;
  useShuffle: () => void;
  useHint: () => void;
  setVolume?: (v: number) => void; // 设置音量 (0..1)
  getVolume?: () => number;
  initData: (config?: GameConfig) => void;
}
