interface Game {
  nodes: Ref<CardNode[]>;
  selectedNodes: Ref<CardNode[]>;
  removeList: Ref<CardNode[]>;
  removeFlag: Ref<boolean>;
  backFlag: Ref<boolean>;
  score: Ref<number>;               // 当前得分
  isGameOver: Ref<boolean>;        // 游戏是否结束
  isPaused: Ref<boolean>;         // 游戏是否暂停
  isSoundEnabled: Ref<boolean>;   // 音效是否开启
  handleSelect: (node: CardNode) => void;
  handleSelectRemove: (node: CardNode) => void;
  handleBack: () => void;
  handleRemove: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;        // 切换暂停状态
  toggleSound: () => void;        // 切换音效状态
  restart: () => void;           // 重新开始游戏
  initData: (config?: GameConfig) => void;
}
interface GameConfig {
  container?: Ref<HTMLElement | undefined>,   // cardNode容器
  cardNum: number,                            // card类型数量
  gridSize: {                                 // 网格大小
    rows: number,
    cols: number
  },
  minMatch?: number,                          // 最小匹配数量
  delNode?: boolean,                          // 是否从nodes中剔除已选节点
  sound?: boolean,                            // 是否开启音效
  events?: GameEvents                         // 游戏事件
}

interface GameEvents {
  clickCallback?: () => void,
  dropCallback?: () => void,
  winCallback?: (score: number) => void,  // 胜利回调，传入最终得分
  loseCallback?: (score: number) => void,
  scoreCallback?: (score: number) => void // 得分更新回调
}

// 卡片节点类型
type CardNode = {
  id: string           // 节点id zIndex-index
  type: number         // 类型
  zIndex: number       // 图层
  index: number        // 所在图层中的索引
  parents: CardNode[]  // 父节点
  row: number          // 行
  column: number       // 列
  top: number         // 顶部位置
  left: number        // 左侧位置
  state: number        // 状态 0：无状态 1：可点击 2：已选 3：已消除
  removeTime?: number  // 消除时间戳
  dropDistance?: number // 下落距离
  isNew?: boolean      // 是否为新卡片
}