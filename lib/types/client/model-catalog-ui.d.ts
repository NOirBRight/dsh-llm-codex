/** Shared model catalog visual pattern extracted from opencode-go. */
import type { CSSProperties, ReactNode } from 'react';
declare const inputStyle: CSSProperties;
declare const rowInputStyle: CSSProperties;
declare const selectStyle: CSSProperties;
declare const rowStyle: CSSProperties;
declare const modelContentStyle: CSSProperties;
declare const modelDetailStyle: CSSProperties;
declare const capabilitiesStyle: CSSProperties;
declare const fieldStyle: CSSProperties;
declare const labelStyle: CSSProperties;
/** Small interface that hides the shared styles behind layout components. */
export declare function ModelCatalogDetails({ children }: {
    children: ReactNode;
}): ReactNode;
export declare function ModelCatalogRow({ children }: {
    children: ReactNode;
}): ReactNode;
export declare function ModelCatalogCapabilities({ children }: {
    children: ReactNode;
}): ReactNode;
export declare function ModelCatalogRowGrid({ children }: {
    children: ReactNode;
}): ReactNode;
export declare const catalogStyles: {
    readonly inputStyle: CSSProperties;
    readonly rowInputStyle: CSSProperties;
    readonly selectStyle: CSSProperties;
    readonly rowStyle: CSSProperties;
    readonly modelContentStyle: CSSProperties;
    readonly modelDetailStyle: CSSProperties;
    readonly capabilitiesStyle: CSSProperties;
    readonly fieldStyle: CSSProperties;
    readonly labelStyle: CSSProperties;
};
export { inputStyle, rowInputStyle, selectStyle, rowStyle, modelContentStyle, modelDetailStyle, capabilitiesStyle, fieldStyle, labelStyle };
//# sourceMappingURL=model-catalog-ui.d.ts.map