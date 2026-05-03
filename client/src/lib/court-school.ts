import { useParams } from "wouter";
import {
  isValidSchool,
  DEFAULT_SCHOOL,
  type SchoolId,
} from "@shared/court-config";

export function useSchool(): SchoolId {
  const params = useParams<{ school?: string }>();
  if (params.school && isValidSchool(params.school)) {
    return params.school as SchoolId;
  }
  return DEFAULT_SCHOOL;
}
