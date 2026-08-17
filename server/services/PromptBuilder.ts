// server/services/PromptBuilder.ts
import { GarmentCategory, GarmentVisualAnalysis, PersonTryOnContext, GarmentTryOnContext } from '../types/index.js';

export class PromptBuilder {
  public static readonly GARMENT_PROMPT_VERSION = 'v1.2';
  public static readonly TRY_ON_PROMPT_VERSION = 'v1.2';

  /**
   * Builds prompt for automated visual analysis of catalog images.
   */
  public static buildGarmentAnalysisPrompt(): string {
    return `
Analyze the provided product image carefully for Virtual Try-On preparation.
Return a STRICT JSON object without markdown fences, conforming to this schema:
{
  "hasModelOrPerson": boolean,
  "hasMannequin": boolean,
  "hasComplexBackground": boolean,
  "hasMultipleGarments": boolean,
  "isPartiallyHidden": boolean,
  "isCropped": boolean,
  "hasOverlappingClothing": boolean,
  "hasBackgroundTextOrLogo": boolean,
  "hasReflectionsOrHarshShadows": boolean,
  "isSharp": boolean,
  "garmentType": string, // e.g. "camiseta", "vestido", "calça jeans", "jaqueta", "tênis"
  "category": "upper_body" | "lower_body" | "full_body" | "shoes",
  "length": string, // e.g. "curto", "midi", "longo", "padrão"
  "sleeves": string, // e.g. "sem manga", "manga curta", "manga longa", "regata"
  "neckline": string, // e.g. "gola redonda", "gola v", "gola alta", "polo", "tomara que caia"
  "primaryColor": string, // e.g. "azul marinho", "preto", "branco"
  "secondaryColors": string[], // e.g. ["dourado", "branco"]
  "pattern": string, // e.g. "liso", "estampado floral", "listrado", "xadrez"
  "texture": string, // e.g. "algodão", "linho", "jeans", "couro", "seda"
  "details": string[], // e.g. ["bolso frontal", "botões madrepérola", "zíper metálico", "bordado peito"]
  "rawSummary": string
}
`.trim();
  }

  /**
   * Builds an adaptive, category-specific prompt for garment segmentation and isolation.
   * Model: gemini-3.1-flash-image
   */
  public static buildGarmentPreparationPrompt(
    category: GarmentCategory,
    analysis?: Partial<GarmentVisualAnalysis>,
    auxiliaryContext?: { name?: string; brand?: string; material?: string }
  ): string {
    let categorySpecificDirectives = '';

    switch (category) {
      case 'upper_body':
        categorySpecificDirectives = `
SPECIFIC DIRECTIVES FOR UPPER BODY APPAREL (TOP / SHIRT / JACKET):
- Preserve the exact neckline/collar style (${analysis?.neckline || 'gola original'}).
- Preserve the exact sleeve length and cuff construction (${analysis?.sleeves || 'mangas originais'}).
- Preserve all chest graphics, prints, embroideries, logos, pockets, and button plackets.
- Preserve the hemline, fabric drape, knit or weave texture, and hem finishing.
- Completely erase the neck, chin, chest, arms, hands, torso, and mannequin stand.
`.trim();
        break;

      case 'lower_body':
        categorySpecificDirectives = `
SPECIFIC DIRECTIVES FOR LOWER BODY APPAREL (PANTS / SHORTS / SKIRT):
- Preserve the exact waistband, belt loops, fly, button closure, and pocket openings.
- Preserve leg silhouette, taper, rise, inseam length, distressed details, whiskering, or denim wash.
- Preserve hem details, cuffs, pleats, side stripes, and zippers.
- Completely erase the waist, legs, feet, shoes, mannequin poles, and background props.
`.trim();
        break;

      case 'full_body':
        categorySpecificDirectives = `
SPECIFIC DIRECTIVES FOR FULL BODY APPAREL (DRESS / JUMPSUIT / OVERALL):
- Preserve the neckline, collar, straps, and shoulder construction.
- Preserve sleeve styling, waistline definition, belt or sash details.
- Preserve skirt/leg silhouette, total garment length (mini/midi/maxi), slits, tiers, and hem drape.
- Preserve all overall prints, floral motifs, patterns, textures, and fastenings.
- Completely erase the head, face, hair, neck, arms, legs, feet, mannequin, and room background.
`.trim();
        break;

      case 'shoes':
        categorySpecificDirectives = `
SPECIFIC DIRECTIVES FOR FOOTWEAR (SHOES / SNEAKERS / BOOTS):
- Preserve the 3D footwear silhouette, toe box shape, heel height, and collar contour.
- Preserve sole architecture, midsole color, tread patterns, eyelets, and laces.
- Preserve leather grain, mesh texture, suede nap, stitching lines, and brand logos.
- Completely erase feet, ankles, socks, legs, shoe trees, and floor shadows.
`.trim();
        break;
    }

    const modelRemovalEmphasis = analysis?.hasModelOrPerson
      ? 'CRITICAL: A HUMAN MODEL IS PRESENT. Completely eliminate all human skin, face, hair, arms, legs, and body contours. The garment must appear as a floating studio product reference.'
      : analysis?.hasMannequin
      ? 'CRITICAL: A MANNEQUIN IS PRESENT. Completely eliminate the plastic/fabric mannequin head, torso, stand, and base.'
      : 'Eliminate all hanger hooks, flat-lay shadows, backdrop paper, and ambient environment.';

    const colorPreservation = analysis?.primaryColor
      ? `Exact Primary Color: ${analysis.primaryColor}. Do NOT alter color hues, saturation, or contrast.`
      : 'Maintain 100% faithful true-to-life coloration.';

    const auxiliaryNotes = auxiliaryContext?.name
      ? `Product Catalog Name: "${auxiliaryContext.name}". (Note: This is auxiliary context only; the provided image is the absolute ground truth).`
      : '';

    return `
[ROLE & TASK: PROFESSIONAL APPAREL ISOLATION FOR VIRTUAL TRY-ON]
Prompt Version: ${this.GARMENT_PROMPT_VERSION}
Garment Category: ${category}
${auxiliaryNotes}

PRIMARY MANDATE:
Use the provided product image as the SOLE visual reference for the garment.
Identify the primary garment intended for virtual try-on (${category}).
Create a clean, studio-style garment reference image showing ONLY the garment itself.

REMOVAL REQUIREMENTS:
${modelRemovalEmphasis}
- Remove the human model, mannequin, body, limbs, face, hair, background, environment, props, and unrelated objects.
- Remove all background studio equipment, shadows, floor reflections, and watermarks.

PRESERVATION REQUIREMENTS:
- ${colorPreservation}
- Preserve the garment's exact visual identity: color, pattern, print, texture, silhouette, neckline, sleeves, length, seams, closures, pockets, embroidery, logos, and construction details.
- Do NOT redesign, restyle, simplify, invent, or alter the garment.
- Do NOT change its colors, pattern, proportions, or construction.
- The result must be a faithful reference image of the SAME garment, isolated for virtual try-on processing.

${categorySpecificDirectives}

OUTPUT FORMAT:
The final output must be a single, centered, studio-clean garment image on a neutral uniform light backdrop, ready for downstream Virtual Try-On neural engines.
`.trim();
  }

  /**
   * Builds the centralized, versioned Virtual Try-On prompt for neural models (e.g. Gemini).
   * Strict semantic separation:
   * - First Image / Subject = PERSON (src)
   * - Second Image / Object = PREPARED GARMENT (ref)
   */
  public static buildTryOnPrompt(
    category: GarmentCategory,
    personContext?: Partial<PersonTryOnContext>,
    garmentContext?: Partial<GarmentTryOnContext>
  ): string {
    const garmentDetails = garmentContext?.keyDetails && garmentContext.keyDetails.length > 0
      ? `Key garment details to reproduce: ${garmentContext.keyDetails.join(', ')}.`
      : '';

    return `
[SYSTEM ROLE: PHOTOREALISTIC VIRTUAL TRY-ON ENGINE]
Try-On Prompt Version: ${this.TRY_ON_PROMPT_VERSION}
Target Garment Category: ${category}

SEMANTIC ROLE DEFINITION:
1. FIRST IMAGE = THE PERSON (SUBJECT - The real individual receiving the clothing).
2. SECOND IMAGE = THE GARMENT (REFERENCE - The isolated technical garment to be worn).
3. NEVER INVERT THE ROLES. The person is the customer; the garment is the product.

CORE INSTRUCTIONS:
- Keep the exact same person from the FIRST image.
- Preserve 100% of the person's identity: face, facial expression, eyes, nose, mouth, skin tone, hair style/color, and head shape.
- Preserve the person's body proportions, physique, natural silhouette, and original pose.
- Preserve the person's background, setting, natural depth, and environmental lighting coherence.
- Replace ONLY the relevant clothing matching category "${category}" with the garment provided in the SECOND image.

GARMENT FIDELITY & PHYSICAL REALISM:
- Dress the person with the EXACT garment shown in the SECOND image.
- Reproduce the exact color, fabric texture, weave, pattern, neckline, collar, sleeves, hems, logos, buttons, zippers, pockets, and stitching.
- The garment must realistically follow the person's body contours, pose, movement, folds, wrinkles, drape, and perspective.
- ${garmentDetails}
- Adapt the lighting on the garment to match the ambient illumination of the person's original photo naturally.

STRICT NEGATIVE CONSTRAINTS:
- DO NOT place the person inside the garment reference image background.
- DO NOT create a side-by-side collage or split screen.
- DO NOT paste the garment as a flat 2D sticker or texture overlay.
- DO NOT alter the person's face, age, gender, race, hair, or body shape.
- DO NOT introduce new garments, accessories, or extraneous people.
- DO NOT hallucinate an altered version of the garment.

FINAL OUTPUT:
Generate a single photorealistic, high-resolution photograph of the SAME PERSON wearing the SELECTED GARMENT naturally.
`.trim();
  }
}
