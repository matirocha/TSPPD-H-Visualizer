/**
 * Formulaciones de Battarra, Erdoğan, Laporte y Vigo (2010), "The Traveling Salesman
 * Problem with Pickups, Deliveries, and Handling Costs", Transportation Science 44(3).
 *
 * Transcritas desde el paper (§2 y §3, Ecs. 1–48) con su numeración original.
 * Notas de transcripción:
 *  - (20): la versión impresa omite el signo "=" (Σ y_ji − Σ y_ij α_i); se restituye
 *    como conservación de flujo, igual que (34), tal como lo describe el texto.
 *  - Las restricciones de subtours (13), (23) y (38) son SEC en el paper; los scripts
 *    Gurobi del proyecto las implementan con MTZ (se indica aparte, no es del paper).
 */
import type { ModelType } from '../../types/solution';

export interface EqLine {
  /** Número de ecuación tal como aparece en el paper, p. ej. "(20)". */
  n: string;
  tex: string;
  /** Dominio de la restricción (se muestra atenuado). */
  where?: string;
}

export interface EqGroup {
  id: string;
  title: string;
  note: string;
  eqs: EqLine[];
  /** Implementación usada por los scripts (no forma parte del paper). */
  impl?: { label: string; tex: string };
}

export interface VarDef {
  sym: string;
  domain?: string;
  text: string;
}

export interface Formulation {
  id: ModelType;
  /** Nombre del modelo en el paper, en LaTeX. */
  paperName: string;
  section: string;
  objective: { n: string; tex: string; note: string };
  variables: VarDef[];
  groups: EqGroup[];
  /** Bloque adicional (Política 2: equivalencia con la Política 1, Ecs. 28–30). */
  extra?: { title: string; lead: string; eqs: (EqLine & { note: string })[]; closing: string };
}

const MTZ = {
  label: 'Gurobi · MTZ',
  tex: String.raw`u_i - u_j + (|V|-1)\,x_{ij} \le |V|-2`,
};

const SEC_TEX = String.raw`\sum_{i,\,j\in S} x_{ij} \le |S| - 1`;
const SEC_WHERE = String.raw`S \subset V,\ |S| \ge 2`;
const DEG_OUT = String.raw`\sum_{j\in V} x_{ij} = 1`;
const DEG_IN = String.raw`\sum_{i\in V} x_{ij} = 1`;
const K_ALL = String.raw`k\in\{1,\dots,Q\}`;

const P1_FLOW_A = String.raw`\sum_{j\in V} y_{ji} - \sum_{j\in V} y_{ij} = \alpha_i`;
const P1_FLOW_B = String.raw`\sum_{j\in V} z_{ij} - \sum_{j\in V} z_{ji} = \beta_i`;
const P1_CAP = String.raw`y_{ij} + z_{ij} \le Q\,x_{ij}`;

export const FORMULATIONS: Record<ModelType, Formulation> = {
  'TSPPD-H': {
    id: 'TSPPD-H',
    paperName: String.raw`(\text{TSPPD-H})`,
    section: '§2 · Formulación indexada por posiciones',
    objective: {
      n: '(1)',
      tex: String.raw`\min\ \sum_{(i,j)\in A} c_{ij}\,x_{ij} + \sum_{i\in V_c}\sum_{k=1}^{Q} v_i^k - \sum_{i\in V_c} h_a\,\alpha_i`,
      note: 'Minimiza ruteo más manipulación. El término constante Σ h_a α_i descuenta las descargas inevitables de las entregas: solo se pagan las operaciones adicionales.',
    },
    variables: [
      { sym: 'x_{ij}', domain: String.raw`\{0,1\}`, text: '1 si y solo si el arco (i, j) ∈ A forma parte de la solución.' },
      {
        sym: 'a_{ij}^k,\ b_{ij}^k',
        domain: String.raw`\{0,1\}`,
        text: 'Presencia de una unidad a (entrega) o b (recogida) en la posición k al recorrer (i, j). Las posiciones se numeran desde la compuerta: k = 1 es la puerta trasera.',
      },
      { sym: 'r_i^k', domain: String.raw`\{0,1\}`, text: '1 si la unidad en la posición k participa en la manipulación en el cliente i.' },
      {
        sym: 'v_i^k',
        domain: String.raw`\ge 0`,
        text: 'Costo unitario de manipulación de la posición k en i. Linealiza v_i^k = Σ_j (h_a a_ji^k + h_b b_ji^k) r_i^k.',
      },
      { sym: "h' = \\max\\{h_a, h_b\\}", text: 'Constante de la linealización (12).' },
    ],
    groups: [
      {
        id: 'deg',
        title: 'Grado',
        note: 'Cada nodo tiene exactamente un arco de salida y uno de entrada.',
        eqs: [
          { n: '(2)', tex: DEG_OUT, where: String.raw`i\in V` },
          { n: '(3)', tex: DEG_IN, where: String.raw`j\in V` },
        ],
      },
      {
        id: 'flow',
        title: 'Conservación de flujo',
        note: 'Balance de las mercancías a y b en cada nodo, sumando sobre todas las posiciones del camión.',
        eqs: [
          { n: '(4)', tex: String.raw`\sum_{j\in V}\sum_{k=1}^{Q}\left(a_{ji}^k - a_{ij}^k\right) = \alpha_i`, where: String.raw`i\in V` },
          { n: '(5)', tex: String.raw`\sum_{j\in V}\sum_{k=1}^{Q}\left(b_{ij}^k - b_{ji}^k\right) = \beta_i`, where: String.raw`i\in V` },
        ],
      },
      {
        id: 'lifo',
        title: 'Regla LIFO',
        note: 'La posición k solo puede manipularse en i si la posición k − 1, más cercana a la compuerta, también se manipuló.',
        eqs: [{ n: '(6)', tex: String.raw`r_i^k \le r_i^{k-1}`, where: String.raw`i\in V_c,\ k\in\{2,\dots,Q\}` }],
      },
      {
        id: 'link',
        title: 'Ocupación de posiciones',
        note: 'Sin arco no hay carga; en un arco usado cada posición aloja a lo más una unidad.',
        eqs: [{ n: '(7)', tex: String.raw`a_{ij}^k + b_{ij}^k \le x_{ij}`, where: String.raw`(i,j)\in A,\ ${K_ALL}` }],
      },
      {
        id: 'stay',
        title: 'Posiciones no manipuladas',
        note: 'Si la posición k no se manipula en i, la unidad que la ocupaba antes del servicio sigue ahí después.',
        eqs: [
          { n: '(8)', tex: String.raw`\sum_{j\in V} a_{ij}^k - \sum_{j\in V} a_{ji}^k \le r_i^k`, where: String.raw`i\in V_c,\ ${K_ALL}` },
          { n: '(9)', tex: String.raw`\sum_{j\in V} a_{ji}^k - \sum_{j\in V} a_{ij}^k \le r_i^k`, where: String.raw`i\in V_c,\ ${K_ALL}` },
          { n: '(10)', tex: String.raw`\sum_{j\in V} b_{ij}^k - \sum_{j\in V} b_{ji}^k \le r_i^k`, where: String.raw`i\in V_c,\ ${K_ALL}` },
          { n: '(11)', tex: String.raw`\sum_{j\in V} b_{ji}^k - \sum_{j\in V} b_{ij}^k \le r_i^k`, where: String.raw`i\in V_c,\ ${K_ALL}` },
        ],
      },
      {
        id: 'cost',
        title: 'Costo de manipulación',
        note: "Con r_i^k = 1, v_i^k toma el costo de la unidad que llega en la posición k; con r_i^k = 0 la cota h' la desactiva.",
        eqs: [
          {
            n: '(12)',
            tex: String.raw`v_i^k \ge \sum_{j\in V}\left(h_a a_{ji}^k + h_b b_{ji}^k\right) - \left(1 - r_i^k\right)h'`,
            where: String.raw`i\in V_c,\ ${K_ALL}`,
          },
        ],
      },
      {
        id: 'sec',
        title: 'Eliminación de subtours',
        note: 'Garantizan la conexidad de la solución.',
        eqs: [{ n: '(13)', tex: SEC_TEX, where: SEC_WHERE }],
        impl: MTZ,
      },
      {
        id: 'dom',
        title: 'Naturaleza de las variables',
        note: 'Ruteo y posiciones binarias; costos unitarios continuos.',
        eqs: [
          { n: '(14)', tex: String.raw`x_{ij},\ a_{ij}^k,\ b_{ij}^k \in \{0,1\}`, where: String.raw`(i,j)\in A,\ ${K_ALL}` },
          { n: '(15)', tex: String.raw`r_i^k \in \{0,1\}`, where: String.raw`i\in V_c,\ ${K_ALL}` },
          { n: '(16)', tex: String.raw`v_i^k \ge 0`, where: String.raw`i\in V_c,\ ${K_ALL}` },
        ],
      },
    ],
  },

  'TSPPD-H_1': {
    id: 'TSPPD-H_1',
    paperName: String.raw`(\text{TSPPD-H}_1)`,
    section: '§3.2 · Formulación con flujos agregados',
    objective: {
      n: '(17)',
      tex: String.raw`\min\ \sum_{(i,j)\in A} c_{ij}\,x_{ij} + \sum_{(i,j)\in A\setminus A_r,\ \alpha_j>0} h_b\,z_{ij}`,
      note: 'En cada arco que llega a un cliente con entrega (α_j > 0), todas las β a bordo bloquean la compuerta y se descargan y recargan a costo h_b. A∖A_r excluye los arcos que vuelven al depósito.',
    },
    variables: [
      { sym: 'x_{ij}', domain: String.raw`\{0,1\}`, text: '1 si y solo si el arco (i, j) ∈ A forma parte de la solución.' },
      { sym: 'y_{ij}', domain: String.raw`\ge 0`, text: 'Unidades de a (entregas α) a bordo mientras el vehículo recorre (i, j).' },
      { sym: 'z_{ij}', domain: String.raw`\ge 0`, text: 'Unidades de b (recogidas β) a bordo en (i, j). Con la Política 1 ocupan la compuerta.' },
    ],
    groups: [
      {
        id: 'deg',
        title: 'Grado',
        note: 'Conservación del flujo del vehículo: una salida y una entrada por nodo.',
        eqs: [
          { n: '(18)', tex: DEG_OUT, where: String.raw`i\in V` },
          { n: '(19)', tex: DEG_IN, where: String.raw`j\in V` },
        ],
      },
      {
        id: 'flow',
        title: 'Conservación de flujo',
        note: 'El vehículo deja α_i unidades de a y recoge β_i unidades de b en cada nodo. (En la versión impresa de (20) falta el signo «=».)',
        eqs: [
          { n: '(20)', tex: P1_FLOW_A, where: String.raw`i\in V` },
          { n: '(21)', tex: P1_FLOW_B, where: String.raw`i\in V` },
        ],
      },
      {
        id: 'cap',
        title: 'Capacidad',
        note: 'La carga a bordo nunca supera Q y solo existe en arcos del tour.',
        eqs: [{ n: '(22)', tex: P1_CAP, where: String.raw`(i,j)\in A` }],
      },
      {
        id: 'sec',
        title: 'Eliminación de subtours',
        note: 'Restricciones SEC usuales.',
        eqs: [{ n: '(23)', tex: SEC_TEX, where: SEC_WHERE }],
        impl: MTZ,
      },
      {
        id: 'dom',
        title: 'Naturaleza de las variables',
        note: 'Ruteo binario; flujos de mercancía continuos.',
        eqs: [
          { n: '(24)', tex: String.raw`x_{ij} \in \{0,1\}`, where: String.raw`(i,j)\in A` },
          { n: '(25)', tex: String.raw`y_{ij},\ z_{ij} \ge 0`, where: String.raw`(i,j)\in A` },
        ],
      },
    ],
  },

  'TSPPD-H_2': {
    id: 'TSPPD-H_2',
    paperName: String.raw`(\text{TSPPD-H}_2)`,
    section: '§3.2 · Misma región factible, otro costo',
    objective: {
      n: '(26)',
      tex: String.raw`\min\ \sum_{(i,j)\in A} c_{ij}\,x_{ij} + \sum_{(i,j)\in A\setminus A_d,\ \beta_i>0} h_a\,y_{ij}`,
      note: 'En cada arco que sale de un cliente con recogida (β_i > 0), las α que siguen a bordo se descargan y recargan a costo h_a para ubicar las β al fondo. A∖A_d excluye los arcos que salen del depósito.',
    },
    variables: [
      { sym: 'x_{ij}', domain: String.raw`\{0,1\}`, text: '1 si y solo si el arco (i, j) ∈ A forma parte de la solución.' },
      { sym: 'y_{ij}', domain: String.raw`\ge 0`, text: 'Unidades de a (entregas α) a bordo en (i, j). Son las que se reubican con costo.' },
      { sym: 'z_{ij}', domain: String.raw`\ge 0`, text: 'Unidades de b (recogidas β) a bordo en (i, j). Con la Política 2 van al fondo, junto a la cabina.' },
    ],
    groups: [
      {
        id: 'st',
        title: 'Restricciones',
        note: 'El conjunto factible es el mismo de TSPPD-H₁; solo cambia el término de manipulación de la función objetivo.',
        eqs: [{ n: '(27)', tex: String.raw`\text{sujeto a}\ \ (18)\ \text{a}\ (25)` }],
      },
      {
        id: 'inherit',
        title: 'Heredadas de TSPPD-H₁',
        note: 'Recordatorio de los flujos y la capacidad que (27) incorpora.',
        eqs: [
          { n: '(20)', tex: P1_FLOW_A, where: String.raw`i\in V` },
          { n: '(21)', tex: P1_FLOW_B, where: String.raw`i\in V` },
          { n: '(22)', tex: P1_CAP, where: String.raw`(i,j)\in A` },
        ],
      },
    ],
    extra: {
      title: 'Equivalencia con la Política 1',
      lead: 'Para un circuito factible (0, 1, …, n, 0) con matriz de costos simétrica, el costo de manipulación de cada política es:',
      eqs: [
        {
          n: '(28)',
          tex: String.raw`h_b\sum_{i=1}^{n-1}(n-i)\,\beta_i = h_b\sum_{i=1}^{n}(n-i)\,\beta_i`,
          note: 'Política 1 (α_i > 0): cada β_i se manipula en los n − i clientes siguientes.',
        },
        {
          n: '(29)',
          tex: String.raw`h_a\sum_{i=2}^{n}(i-1)\,\alpha_i = h_a\sum_{i=1}^{n}(i-1)\,\alpha_i`,
          note: 'Política 2 (β_i > 0): cada α_i se reubica en los i − 1 clientes previos.',
        },
        {
          n: '(30)',
          tex: String.raw`h_b^{*}\sum_{j=1}^{n}(n-j)\,\beta_j^{*} = h_a\sum_{i=1}^{n}(i-1)\,\alpha_i`,
          note: 'Circuito invertido, con j = n − i + 1, h_b* = h_a, β_j* = α_{n−i+1} y α_j* = β_{n−i+1}.',
        },
      ],
      closing:
        'Proposición 2: con c_ij simétrica y β_i > 0, una solución óptima de TSPPD-H₂ se obtiene invirtiendo una óptima de TSPPD-H₁ para la instancia con α ↔ β y h_a ↔ h_b permutados.',
    },
  },

  'TSPPD-H_3': {
    id: 'TSPPD-H_3',
    paperName: String.raw`(\text{TSPPD-H}_3)`,
    section: '§3.3 · Elección de política por cliente',
    objective: {
      n: '(31)',
      tex: String.raw`\min\ \sum_{(i,j)\in A} c_{ij}\,x_{ij} + \sum_{(i,j)\in A\setminus A_r,\ \alpha_j>0} h_b\,z_{ij} + \sum_{i\in V_c} q_i`,
      note: 'Ruteo más el costo de la Política 1 sobre las β en compuerta (z_ij); el término Σ q_i ajusta el costo en los clientes donde se aplica la Política 2.',
    },
    variables: [
      { sym: 'x_{ij}', domain: String.raw`\{0,1\}`, text: '1 si y solo si el arco (i, j) ∈ A forma parte de la solución.' },
      { sym: 's_i', domain: String.raw`\{0,1\}`, text: '1 si en el cliente i se aplica la Política 1; 0 si se aplica la Política 2.' },
      { sym: 'y_{ij}', domain: String.raw`\ge 0`, text: 'Unidades de a (entregas α) a bordo en (i, j).' },
      { sym: 'w_{ij}', domain: String.raw`\ge 0`, text: 'Unidades de b ubicadas al frente del vehículo (fondo, junto a la cabina) en (i, j).' },
      { sym: 'z_{ij}', domain: String.raw`\ge 0`, text: 'Unidades de b ubicadas en la parte trasera (compuerta) en (i, j).' },
      { sym: 'p_i,\ q_i', domain: String.raw`\ge 0`, text: 'Reparto del costo de manipulación en i: p_i si s_i = 1, q_i si s_i = 0. Solo q_i entra en (31).' },
    ],
    groups: [
      {
        id: 'deg',
        title: 'Grado',
        note: 'Una salida y una entrada por nodo.',
        eqs: [
          { n: '(32)', tex: DEG_OUT, where: String.raw`i\in V` },
          { n: '(33)', tex: DEG_IN, where: String.raw`j\in V` },
        ],
      },
      {
        id: 'flow',
        title: 'Conservación de flujo',
        note: 'Balance de a y del total de b (bloque frontal w más bloque trasero z) en cada cliente.',
        eqs: [
          { n: '(34)', tex: P1_FLOW_A, where: String.raw`i\in V_c` },
          {
            n: '(35)',
            tex: String.raw`\sum_{j\in V}\left(w_{ij} + z_{ij}\right) - \sum_{j\in V}\left(w_{ji} + z_{ji}\right) = \beta_i`,
            where: String.raw`i\in V_c`,
          },
        ],
      },
      {
        id: 'front',
        title: 'Bloque frontal de β',
        note: 'El bloque w solo crece en i si s_i = 0 (Política 2); con s_i = 1 las β recogidas quedan en la compuerta.',
        eqs: [
          {
            n: '(36)',
            tex: String.raw`\sum_{j\in V} w_{ij} - \sum_{j\in V} w_{ji} \le \left(1 - s_i\right)\left(\sum_{j\in V_c}\beta_j\right)`,
            where: String.raw`i\in V_c`,
          },
        ],
      },
      {
        id: 'cap',
        title: 'Capacidad',
        note: 'Los tres bloques juntos no superan Q.',
        eqs: [{ n: '(37)', tex: String.raw`w_{ij} + y_{ij} + z_{ij} \le Q\,x_{ij}`, where: String.raw`(i,j)\in A` }],
      },
      {
        id: 'sec',
        title: 'Eliminación de subtours',
        note: 'Restricciones SEC usuales.',
        eqs: [{ n: '(38)', tex: SEC_TEX, where: SEC_WHERE }],
        impl: MTZ,
      },
      {
        id: 'cost0',
        title: 'Costo en clientes sin entrega (α_i = 0)',
        note: 'Si s_i = 1 el costo queda en p_i y q_i = 0; si s_i = 0, q_i = Σ h_a y_ij + Σ h_b z_ji.',
        eqs: [
          {
            n: '(39)',
            tex: String.raw`\sum_{j\in V} h_a\,y_{ij} + \sum_{j\in V} h_b\,z_{ji} = p_i + q_i`,
            where: String.raw`i\in V_c:\ \alpha_i = 0`,
          },
          {
            n: '(40)',
            tex: String.raw`p_i \le \left(h_a\sum_{j\in V_c}\alpha_j + h_b\sum_{j\in V_c}\beta_j\right)s_i`,
            where: String.raw`i\in V_c:\ \alpha_i = 0`,
          },
          {
            n: '(41)',
            tex: String.raw`q_i \le \left(h_a\sum_{j\in V_c}\alpha_j + h_b\sum_{j\in V_c}\beta_j\right)\left(1 - s_i\right)`,
            where: String.raw`i\in V_c:\ \alpha_i = 0`,
          },
        ],
      },
      {
        id: 'cost1',
        title: 'Costo en clientes con entrega (α_i > 0)',
        note: 'Si s_i = 1, q_i = 0; si s_i = 0, q_i = Σ h_a y_ij: se reubican las α que siguen a bordo.',
        eqs: [
          { n: '(42)', tex: String.raw`\sum_{j\in V} h_a\,y_{ij} = p_i + q_i`, where: String.raw`i\in V_c:\ \alpha_i > 0` },
          { n: '(43)', tex: String.raw`p_i \le \left(h_a\sum_{j\in V_c}\alpha_j\right)s_i`, where: String.raw`i\in V_c:\ \alpha_i > 0` },
          { n: '(44)', tex: String.raw`q_i \le \left(h_a\sum_{j\in V_c}\alpha_j\right)\left(1 - s_i\right)`, where: String.raw`i\in V_c:\ \alpha_i > 0` },
        ],
      },
      {
        id: 'dom',
        title: 'Naturaleza de las variables',
        note: 'Ruteo y política binarios; flujos y costos continuos.',
        eqs: [
          { n: '(45)', tex: String.raw`x_{ij} \in \{0,1\}`, where: String.raw`(i,j)\in A` },
          { n: '(46)', tex: String.raw`s_i \in \{0,1\}`, where: String.raw`i\in V_c` },
          { n: '(47)', tex: String.raw`y_{ij},\ w_{ij},\ z_{ij} \ge 0`, where: String.raw`(i,j)\in A` },
          { n: '(48)', tex: String.raw`p_i,\ q_i \ge 0`, where: String.raw`i\in V_c` },
        ],
      },
    ],
  },
};

/** Notación común (§1–§2 del paper). */
export const NOTATION: { tex: string; text: string }[] = [
  { tex: String.raw`G = (V, A)`, text: 'grafo dirigido completo' },
  { tex: String.raw`V = \{0, 1, \dots, n\}`, text: '0 es el depósito' },
  { tex: String.raw`V_c = V \setminus \{0\}`, text: 'clientes' },
  { tex: String.raw`A_d,\ A_r`, text: 'arcos que salen de / llegan al depósito' },
  { tex: String.raw`c_{ij}`, text: 'tiempo de viaje del arco' },
  { tex: String.raw`\alpha_i,\ \beta_i`, text: 'demanda a / oferta b del cliente' },
  { tex: String.raw`Q`, text: 'capacidad' },
  { tex: String.raw`h_a,\ h_b`, text: 'tiempo por operación adicional' },
];
