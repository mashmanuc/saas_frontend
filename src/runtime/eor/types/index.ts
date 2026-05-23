/**
 * Educational Object Runtime — types public API.
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md
 *
 * P1.a deliverable — type declarations only. NO runtime code.
 * Use this barrel to import types from EOR.
 */

// Identity model
export type {
  EOIdentity,
  NormalizedEOIdentity,
  MountedEOIdentity,
} from './identity'

// Capabilities
export type { Capability, CapabilitySet } from './capabilities'

// Op envelope
export type { EOpType, EOpEnvelope } from './op-envelope'

// Render
export type { Surface, RenderMode, RenderDescriptor } from './surface'

// Transport
export type {
  TransportPolicyKind,
  TransportPolicyBase,
  SnapshotPolicy,
  ThrottledParamPolicy,
  DirectCallbackPolicy,
  TransportPolicy,
  TransportEventRouting,
  TransportDeclaration,
  TransportDispatcher,
} from './transport'

// Inspector
export type { Reactive, InspectorBridge } from './inspector-bridge'

// Adapter host
export type { AdapterEventBus, AdapterHostContext } from './adapter-host'

// Adapter family
export type {
  EODataBase,
  RuntimeAdapter,
  PersistenceAdapter,
  RenderAdapter,
  InspectorAdapter,
} from './adapters'

// Top-level EO definition
export type { EducationalObjectDefinition } from './eo-definition'
