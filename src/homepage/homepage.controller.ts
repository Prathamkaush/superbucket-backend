import { Controller, Get } from "@nestjs/common";
import { HomepageService } from "./homepage.service";

@Controller("homepage")
export class HomepageController {
  constructor(private service: HomepageService) {}

  @Get()
  getHomepage() {
    return this.service.getActiveSections();
  }
  
}
