import * as XLSX from 'xlsx';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ParsedProductRow } from '../dto/bulk-upload-product.dto';
import * as AdmZip from 'adm-zip';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SMART PARSER - Supports both IDs and Names for all attributes
 * 
 * Users can now use either:
 * - Category ID: 1 OR Category Name: "Dresses"
 * - Color ID: 5 OR Color Name: "Red"
 * - Season ID: 2 OR Season Name: "Summer"
 * etc.
 */
@Injectable()
export class SmartBulkProductParser {
  constructor(private prisma: PrismaService) {}

  /**
   * Parse CSV/Excel with optional ZIP file - SMART MODE
   * Converts names to IDs automatically
   */
  async parseFile(
    buffer: Buffer,
    filename: string,
    zipBuffer?: Buffer,
  ): Promise<{
    products: ParsedProductRow[];
    imageMap: Map<string, string>;
    mapping: {
      categories: Map<string, number>;
      types: Map<string, number>;
      subtypes: Map<string, number>;
      seasons: Map<string, number>;
      colors: Map<string, number>;
      fabrics: Map<string, number>;
      occasions: Map<string, number>;
      fits: Map<string, number>;
      sleeves: Map<string, number>;
      patterns: Map<string, number>;
      vendors: Map<string, number>;
    };
  }> {
    const isExcel = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    const isCsv = filename.endsWith('.csv');

    if (!isExcel && !isCsv) {
      throw new BadRequestException(
        'Invalid file format. Please upload .csv or .xlsx file',
      );
    }

    // Extract images from ZIP if provided
    const imageMap = zipBuffer
      ? this.extractImagesFromZip(zipBuffer)
      : new Map<string, string>();

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
      });

      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('File is empty or has no data rows');
      }

      // Load all available options from database
      const mapping = await this.loadDatabaseMapping();

      // Validate and map rows
      const products = await this.validateAndMapRows(rawData, mapping);

      return { products, imageMap, mapping };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Load all available options from database for smart mapping
   */
  private async loadDatabaseMapping(): Promise<{
    categories: Map<string, number>;
    types: Map<string, number>;
    subtypes: Map<string, number>;
    seasons: Map<string, number>;
    colors: Map<string, number>;
    fabrics: Map<string, number>;
    occasions: Map<string, number>;
    fits: Map<string, number>;
    sleeves: Map<string, number>;
    patterns: Map<string, number>;
    vendors: Map<string, number>;
  }> {
    const mapping = {
      categories: new Map<string, number>(),
      types: new Map<string, number>(),
      subtypes: new Map<string, number>(),
      seasons: new Map<string, number>(),
      colors: new Map<string, number>(),
      fabrics: new Map<string, number>(),
      occasions: new Map<string, number>(),
      fits: new Map<string, number>(),
      sleeves: new Map<string, number>(),
      patterns: new Map<string, number>(),
      vendors: new Map<string, number>(),
    };

    try {
      // Load categories
      const categories = await this.prisma.category.findMany();
      categories.forEach((c) => {
        mapping.categories.set(c.id.toString(), c.id); // ID
        mapping.categories.set(c.name.toLowerCase(), c.id); // Name
      });

      // Load types
      const types = await this.prisma.productType.findMany();
      types.forEach((t) => {
        mapping.types.set(t.id.toString(), t.id);
        mapping.types.set(t.name.toLowerCase(), t.id);
      });

      // Load subtypes
      const subtypes = await this.prisma.productSubtype.findMany();
      subtypes.forEach((s) => {
        mapping.subtypes.set(s.id.toString(), s.id);
        mapping.subtypes.set(s.name.toLowerCase(), s.id);
      });

      // Load seasons
      const seasons = await this.prisma.season.findMany();
      seasons.forEach((s) => {
        mapping.seasons.set(s.id.toString(), s.id);
        mapping.seasons.set(s.name.toLowerCase(), s.id);
      });

      // Load colors
      const colors = await this.prisma.color.findMany();
      colors.forEach((c) => {
        mapping.colors.set(c.id.toString(), c.id);
        mapping.colors.set(c.name.toLowerCase(), c.id);
      });

      // Load fabrics
      const fabrics = await this.prisma.fabric.findMany();
      fabrics.forEach((f) => {
        mapping.fabrics.set(f.id.toString(), f.id);
        mapping.fabrics.set(f.name.toLowerCase(), f.id);
      });

      // Load occasions
      const occasions = await this.prisma.occasion.findMany();
      occasions.forEach((o) => {
        mapping.occasions.set(o.id.toString(), o.id);
        mapping.occasions.set(o.name.toLowerCase(), o.id);
      });

      // Load fits
      const fits = await this.prisma.fit.findMany();
      fits.forEach((f) => {
        mapping.fits.set(f.id.toString(), f.id);
        mapping.fits.set(f.name.toLowerCase(), f.id);
      });

      // Load sleeves
      const sleeves = await this.prisma.sleeve.findMany();
      sleeves.forEach((s) => {
        mapping.sleeves.set(s.id.toString(), s.id);
        mapping.sleeves.set(s.name.toLowerCase(), s.id);
      });

      // Load patterns
      const patterns = await this.prisma.pattern.findMany();
      patterns.forEach((p) => {
        mapping.patterns.set(p.id.toString(), p.id);
        mapping.patterns.set(p.name.toLowerCase(), p.id);
      });

      // Load vendors
      const vendors = await this.prisma.vendor.findMany();
      vendors.forEach((v) => {
        mapping.vendors.set(v.id.toString(), v.id);
        mapping.vendors.set(v.companyName.toLowerCase(), v.id);
      });
    } catch (error) {
      console.error('Error loading database mapping:', error);
      // Continue with empty mapping if database fails
    }

    return mapping;
  }

  /**
   * Convert name/ID to actual ID using mapping
   */
  private resolveToId(
    value: string | number | undefined,
    mappingMap: Map<string, number>,
    fieldName: string,
  ): number | null {
    if (!value) return null;

    const strValue = String(value).trim();
    
    // Try as is
    const id = mappingMap.get(strValue);
    if (id) return id;

    // Try lowercase (for names)
    const idLower = mappingMap.get(strValue.toLowerCase());
    if (idLower) return idLower;

    // Try as number
    const numValue = parseInt(strValue);
    if (!isNaN(numValue) && mappingMap.has(numValue.toString())) {
      const resolvedId = mappingMap.get(numValue.toString());
      if (resolvedId) return resolvedId;
    }

    throw new Error(
      `${fieldName} "${strValue}" not found. Available: ${Array.from(
        mappingMap.keys(),
      )
        .filter((k) => isNaN(Number(k)))
        .slice(0, 5)
        .join(', ')}...`,
    );
  }

  /**
   * Convert comma-separated names/IDs to ID array
   */
  private resolveToIdArray(
    value: string | undefined,
    mappingMap: Map<string, number>,
    fieldName: string,
  ): number[] {
    if (!value || !value.trim()) return [];

    try {
      const ids = value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => {
          const id = this.resolveToId(item, mappingMap, fieldName);
          if (id === null) {
            throw new Error(`Invalid ${fieldName}: ${item}`);
          }
          return id;
        });

      // Remove duplicates
      return Array.from(new Set(ids));
    } catch (error) {
      throw new Error(`${fieldName}: ${error.message}`);
    }
  }

  /**
   * Validate and map raw rows to ParsedProductRow
   */
  private async validateAndMapRows(
    rawData: any[],
    mapping: any,
  ): Promise<ParsedProductRow[]> {
    const products: ParsedProductRow[] = [];
    const errors: string[] = [];

    for (let index = 0; index < rawData.length; index++) {
      const row = rawData[index];
      const rowNumber = index + 2;

      try {
        const product = await this.mapRow(row, rowNumber, mapping);
        products.push(product);
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed for some rows',
        errors: errors.slice(0, 20),
        totalErrors: errors.length,
      });
    }

    return products;
  }

  /**
   * Map a single row - SMART MODE
   */
  private async mapRow(
    row: any,
    rowNumber: number,
    mapping: any,
  ): Promise<ParsedProductRow> {
    const getValue = (key: string): any => {
      const found = Object.keys(row).find(
        (k) => k.toLowerCase().trim() === key.toLowerCase(),
      );
      return found ? row[found] : undefined;
    };

    // ============ REQUIRED FIELDS ============
    const title = getValue('title') || getValue('product_name');
    if (!title || !title.trim()) {
      throw new Error('Title is required');
    }

    // SMART: Category - accept both ID and name
    const categoryValue = getValue('category_id') || getValue('category');
    let categoryId: number;
    try {
      categoryId = this.resolveToId(
        categoryValue,
        mapping.categories,
        'Category',
      );
      if (categoryId === null) {
        throw new Error('Required');
      }
    } catch (error) {
      throw new Error(`Category: ${error.message}`);
    }

    // SMART: Type - accept both ID and name
    const typeValue = getValue('type_id') || getValue('type');
    let typeId: number;
    try {
      typeId = this.resolveToId(typeValue, mapping.types, 'Type');
      if (typeId === null) {
        throw new Error('Required');
      }
    } catch (error) {
      throw new Error(`Type: ${error.message}`);
    }

    // SMART: Subtype - accept both ID and name
    const subtypeValue = getValue('subtype_id') || getValue('subtype');
    let subtypeId: number;
    try {
      subtypeId = this.resolveToId(subtypeValue, mapping.subtypes, 'Subtype');
      if (subtypeId === null) {
        throw new Error('Required');
      }
    } catch (error) {
      throw new Error(`Subtype: ${error.message}`);
    }

    const price = parseFloat(getValue('price'));
    if (isNaN(price) || price < 0) {
      throw new Error('Valid price is required');
    }

    const stock = parseInt(getValue('stock'));
    if (isNaN(stock) || stock < 0) {
      throw new Error('Valid stock is required');
    }

    const weight = parseFloat(getValue('weight'));
    if (isNaN(weight) || weight < 0.05 || weight > 10) {
      throw new Error('Weight must be between 0.05kg and 10kg');
    }

    const sizesStr = getValue('sizes');
    if (!sizesStr || !sizesStr.trim()) {
      throw new Error('At least one size is required');
    }

    // ============ DISCOUNT VALIDATION ============
    const discountType = getValue('discount_type') || getValue('discounttype');
    const discountValue =
      getValue('discount_value') || getValue('discountvalue');

    if (discountType && discountValue) {
      const discount = parseFloat(discountValue);

      if (!['PERCENT', 'FLAT'].includes(discountType.toUpperCase())) {
        throw new Error('discount_type must be PERCENT or FLAT');
      }

      if (isNaN(discount) || discount <= 0) {
        throw new Error('discount_value must be greater than 0');
      }

      if (discountType.toUpperCase() === 'PERCENT' && discount > 100) {
        throw new Error('discount_value cannot exceed 100 for PERCENT type');
      }

      if (discountType.toUpperCase() === 'FLAT' && discount >= price) {
        throw new Error('FLAT discount must be less than price');
      }
    }

    // ============ OPTIONAL FIELDS WITH SMART MAPPING ============
    const estimatedShipping = getValue('estimated_shipping')
      ? parseInt(getValue('estimated_shipping'))
      : 3;

    // SMART: Season - accept both ID and name
    let seasonId: number | undefined;
    const seasonValue = getValue('season_id') || getValue('season');
    if (seasonValue) {
      try {
        seasonId = this.resolveToId(seasonValue, mapping.seasons, 'Season');
      } catch {
        seasonId = undefined; // Optional field
      }
    }

    // SMART: Attributes - accept both IDs and names
    const colorValues = getValue('colors');
    let colorIds: number[] = [];
    if (colorValues) {
      try {
        colorIds = this.resolveToIdArray(colorValues, mapping.colors, 'Colors');
      } catch {
        colorIds = []; // Optional
      }
    }

    const fabricValues = getValue('fabrics');
    let fabricIds: number[] = [];
    if (fabricValues) {
      try {
        fabricIds = this.resolveToIdArray(fabricValues, mapping.fabrics, 'Fabrics');
      } catch {
        fabricIds = [];
      }
    }

    const occasionValues = getValue('occasions');
    let occasionIds: number[] = [];
    if (occasionValues) {
      try {
        occasionIds = this.resolveToIdArray(
          occasionValues,
          mapping.occasions,
          'Occasions',
        );
      } catch {
        occasionIds = [];
      }
    }

    const fitValues = getValue('fits');
    let fitIds: number[] = [];
    if (fitValues) {
      try {
        fitIds = this.resolveToIdArray(fitValues, mapping.fits, 'Fits');
      } catch {
        fitIds = [];
      }
    }

    const sleeveValues = getValue('sleeves');
    let sleeveIds: number[] = [];
    if (sleeveValues) {
      try {
        sleeveIds = this.resolveToIdArray(sleeveValues, mapping.sleeves, 'Sleeves');
      } catch {
        sleeveIds = [];
      }
    }

    const patternValues = getValue('patterns');
    let patternIds: number[] = [];
    if (patternValues) {
      try {
        patternIds = this.resolveToIdArray(
          patternValues,
          mapping.patterns,
          'Patterns',
        );
      } catch {
        patternIds = [];
      }
    }

    return {
      title: title.trim(),
      categoryId,
      typeId,
      subtypeId,
      price,
      stock,
      weight,

      description: getValue('description')?.trim() || '',
      discountType: discountType ? discountType.toUpperCase() : undefined,
      discountValue: discountValue ? parseFloat(discountValue) : undefined,

      isTrending: this.parseBoolean(
        getValue('is_trending') || getValue('istrending'),
      ),
      freeShipping: this.parseBoolean(
        getValue('free_shipping') || getValue('freeshipping'),
      ),

      estimatedShipping,
      seasonId,

      sizes: sizesStr,

      // Now these contain IDs (converted from names)
      colors: colorIds.join(','),
      fabrics: fabricIds.join(','),
      occasions: occasionIds.join(','),
      fits: fitIds.join(','),
      sleeves: sleeveIds.join(','),
      patterns: patternIds.join(','),

      vendors: getValue('vendors')?.trim() || '',

      image1: getValue('image1') || getValue('image_1'),
      image2: getValue('image2') || getValue('image_2'),
      image3: getValue('image3') || getValue('image_3'),
      image4: getValue('image4') || getValue('image_4'),

      metaTitle: getValue('meta_title')?.trim() || '',
      metaDescription: getValue('meta_description')?.trim() || '',
      metaKeywords: getValue('meta_keywords')?.trim() || '',

      // Store original values for reference
      _original: {
        colors: colorValues,
        fabrics: fabricValues,
        occasions: occasionValues,
        fits: fitValues,
        sleeves: sleeveValues,
        patterns: patternValues,
      },
    };
  }

  /**
   * Extract images from ZIP
   */
  private extractImagesFromZip(zipBuffer: Buffer): Map<string, string> {
    const imageMap = new Map<string, string>();
    const uploadDir = './uploads/products';

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    try {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      zipEntries.forEach((entry) => {
        if (entry.isDirectory) return;

        const ext = path.extname(entry.entryName).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

        if (!allowedExts.includes(ext)) return;

        const originalName = path.basename(entry.entryName);
        const uniqueName = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}${ext}`;
        const savePath = path.join(uploadDir, uniqueName);

        fs.writeFileSync(savePath, entry.getData());
        imageMap.set(originalName, uniqueName);
      });

      return imageMap;
    } catch (error) {
      throw new BadRequestException(
        `Failed to extract images from ZIP: ${error.message}`,
      );
    }
  }

  /**
   * Parse boolean values
   */
  private parseBoolean(value: any): boolean {
    if (value === undefined || value === null || value === '') {
      return false;
    }
    const str = String(value).toLowerCase().trim();
    return ['true', '1', 'yes', 'y'].includes(str);
  }

  /**
   * Generate SMART template with available options
   */
  async generateSmartTemplate(): Promise<string> {
    const mapping = await this.loadDatabaseMapping();

    // Get first few options from each category for examples
    const getCategoryExample = () =>
      Array.from(mapping.categories.keys())
        .filter((k) => isNaN(Number(k)))
        .slice(0, 3)
        .join(' OR ');

    const getTypeExample = () =>
      Array.from(mapping.types.keys())
        .filter((k) => isNaN(Number(k)))
        .slice(0, 3)
        .join(' OR ');

    const getColorExample = () =>
      Array.from(mapping.colors.keys())
        .filter((k) => isNaN(Number(k)))
        .slice(0, 3)
        .join(',');

    const headers = [
      'title',
      'category_id',
      'type_id',
      'subtype_id',
      'price',
      'stock',
      'weight',
      'sizes',
      'description',
      'discount_type',
      'discount_value',
      'is_trending',
      'free_shipping',
      'estimated_shipping',
      'season_id',
      'colors',
      'fabrics',
      'occasions',
      'fits',
      'sleeves',
      'patterns',
      'vendors',
      'image1',
      'image2',
      'image3',
      'image4',
      'meta_title',
      'meta_description',
      'meta_keywords',
    ];

    const exampleRow = [
      'Premium Cotton T-Shirt',
      'Dresses', // Can use name instead of 1
      'Tops', // Can use name instead of 2
      'T-Shirt', // Can use name instead of 3
      '799',
      '100',
      '0.25',
      'S:20,M:30,L:30,XL:20',
      'Soft and comfortable premium cotton t-shirt',
      'PERCENT',
      '15',
      'true',
      'false',
      '3',
      'Red,Blue', // Can use names instead of 1,2
      'Cotton,Linen', // Can use names instead of 1,2
      'Casual,Daily', // Can use names instead of 1,3
      'Slim', // Can use name instead of ID
      'Half Sleeve', // Can use name instead of ID
      'Solid', // Can use name instead of ID
      '1:450:Cotton:50', // Vendor name or ID
      'tshirt-front.jpg',
      'tshirt-back.jpg',
      '',
      '',
      'Cotton T-Shirt - Premium',
      'Buy premium cotton t-shirts online',
      'cotton,tshirt,casual',
    ];

    return (
      `# SMART BULK UPLOAD TEMPLATE\n` +
      `# You can use either NAMES or IDs for all fields!\n\n` +
      `# Available options:\n` +
      `# Categories: ${getCategoryExample()}\n` +
      `# Colors: ${getColorExample()}\n` +
      `# Fabrics: ${Array.from(mapping.fabrics.keys())
        .filter((k) => isNaN(Number(k)))
        .slice(0, 3)
        .join(',')}\n\n` +
      headers.join(',') +
      '\n' +
      exampleRow.join(',')
    );
  }

  /**
   * Generate instructions with name/ID examples
   */
  static generateSmartInstructions(): string {
    return `
SMART BULK UPLOAD - NAMES & IDs SUPPORTED!
===========================================

NEW FEATURE: You can now use NAMES instead of IDs!

EXAMPLES - USE EITHER:

1. CATEGORY
   ✓ Use ID: category_id = 1
   ✓ Use Name: category_id = Dresses
   ✓ Use Name: category = Women's Wear

2. TYPE
   ✓ Use ID: type_id = 2
   ✓ Use Name: type_id = Tops
   ✓ Use Name: type = Shirts

3. COLORS (comma-separated names OR IDs)
   ✓ colors = 1,2,3
   ✓ colors = Red,Blue,Green
   ✓ colors = Red,2,Blue (MIX both!)

4. FABRICS (comma-separated names OR IDs)
   ✓ fabrics = Cotton,Silk
   ✓ fabrics = 1,4,5
   ✓ fabrics = Cotton,4,Linen

5. SEASON
   ✓ season_id = 1
   ✓ season = Summer
   ✓ season_id = Winter

6. VENDORS
   ✓ vendors = 1:450:Cotton:50
   ✓ vendors = Vendor A:450:Cotton:50
   ✓ vendors = 1:450:Cotton:50|Vendor B:500:Silk:30

REQUIRED FIELDS (Names or IDs):
  - title: Product name
  - category_id/category: Category name or ID
  - type_id/type: Type name or ID
  - subtype_id/subtype: Subtype name or ID
  - price: Numeric price
  - stock: Quantity
  - weight: 0.05 to 10 kg
  - sizes: Format S:10,M:20,L:15

OPTIONAL FIELDS (Use names!):
  - season_id/season: Season name or ID
  - colors: Comma-separated color names or IDs
  - fabrics: Comma-separated fabric names or IDs
  - occasions: Comma-separated occasion names or IDs
  - fits: Comma-separated fit names or IDs
  - sleeves: Comma-separated sleeve names or IDs
  - patterns: Comma-separated pattern names or IDs
  - vendors: Format: Name/ID:Cost:Type:Qty

CASE INSENSITIVE:
  ✓ colors = red (same as RED or Red)
  ✓ season = summer (same as SUMMER or Summer)

MIXED IDs AND NAMES:
  ✓ colors = Red,3,Blue,5 (works!)
  ✓ season = Summer (or use ID 2)
  ✓ fabrics = Cotton,4,Silk

TIPS:
  1. Download the smart template - it shows available options
  2. Use names for better readability
  3. Use IDs if you know them (faster)
  4. Mix names and IDs in one field
  5. Case doesn't matter

ERRORS:
  If you get "Category 'Dresses' not found":
  - Check spelling
  - Check capitalization (usually not needed)
  - Use the template to see available options
`.trim();
  }
}