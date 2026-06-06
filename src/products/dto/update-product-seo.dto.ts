import { IsOptional, IsString } from "class-validator";

export class UpdateProductSeoDto {

@IsString()
@IsOptional()    
slug?: string;

@IsString()
@IsOptional()    
metaTitle?: string;

@IsString()
@IsOptional()    
metaDescription?: string;

@IsString()
@IsOptional()
metaKeywords?: string;

}
