import express from 'express'
import { addCourse, deleteCourse, educatorDashboardData, getCourseForEdit, getEducatorCourses, getEnrolledStudentsData, updateCourse, updateRoleToEducator } from '../controllers/educatorController.js';
import upload from '../configs/multer.js';
import { protectEducator } from '../middlewares/authMiddleware.js';


const educatorRouter = express.Router()

// Add Educator Role 
educatorRouter.get('/update-role', updateRoleToEducator)

// Add Courses 
educatorRouter.post('/add-course', upload.single('image'), protectEducator, addCourse)

// Update Course
educatorRouter.put('/course/:courseId', upload.single('image'), protectEducator, updateCourse)

// Get Course for Editing
educatorRouter.get('/course/:courseId', protectEducator, getCourseForEdit)

// Get Educator Courses 
educatorRouter.get('/courses', protectEducator, getEducatorCourses)

// Get Educator Dashboard Data
educatorRouter.get('/dashboard', protectEducator, educatorDashboardData)

// Get Educator Students Data
educatorRouter.get('/enrolled-students', protectEducator, getEnrolledStudentsData)

// Delete Course
educatorRouter.delete('/course/:courseId', protectEducator, deleteCourse)


export default educatorRouter;